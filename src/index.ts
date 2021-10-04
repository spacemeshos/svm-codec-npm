export const OK_MARKER = 1;
export const ERR_MARKER = 0;

let codec: WebAssembly.Instance;

// Init the library with the binary content of a .wasm file.
// This function must be called once per client prior to use of any other package functions.
export async function init(code: BufferSource) {
    const wasm = await WebAssembly.compile(code);
    codec = await WebAssembly.instantiate(wasm, {})
}

// Returns true iff library was initialized with wasm code
export function isInitialized() {
    return (codec !== null)
}

// User input to the encodeDeployData function
export interface DeployData {
    svm_version: number,
    code_version: number,
    name: string,
    desc: string,
    code: string,
    data: string,
    ctors: Array<string>
}

// User input to the encodeSpawnData function
export interface SpawnData {
    version: number,
    template: string,
    name: string
    ctor_name: string,
    calldata: Uint8Array,
}

// User input to the encodeCallData function
export interface CallData {
    version: number,
    target: string,
    func_name: string,
    verifydata: string,
    calldata: Uint8Array,
}

// Encodes the provided deploy template data
export function encodeDeployData(data: DeployData) : Uint8Array {
    const buf = newWasmBuffer(data);
    const result = call("wasm_encode_deploy", buf);
    const len = wasmBufferLength(result);
    const slice = wasmBufferDataSlice(result, 0, len);

    if (slice[0] !== OK_MARKER) {
        throw loadWasmBufferError(result);
    }

    wasmBufferFree(buf);
    wasmBufferFree(result);
    return slice.slice(1);
}

// Encodes the provided spawn app data
export function encodeSpawnData(data: SpawnData) : Uint8Array {
    const buf = newWasmBuffer(data);
    const result = call("wasm_encode_spawn", buf);
    const len = wasmBufferLength(result);
    const slice = wasmBufferDataSlice(result, 0, len);

    if (slice[0] !== OK_MARKER) {
        throw loadWasmBufferError(result);
    }

    wasmBufferFree(buf);
    wasmBufferFree(result);
    return slice.slice(1);
}

// Decodes the provided svm encoded spwan data
export function decodeSpawnData(data: Uint8Array) : JSON {
    const buf = newWasmBuffer({data: binToString(data)});
    const result = call("wasm_decode_spawn", buf);
    const json = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return json;
}

// Encodes the provided call account data
export function encodeCallData(data:CallData) : Uint8Array {
    const buf = newWasmBuffer(data);
    const result = call("wasm_encode_call", buf);
    const len = wasmBufferLength(result);
    const slice = wasmBufferDataSlice(result, 0, len);

    if (slice[0] !== OK_MARKER) {
        throw loadWasmBufferError(result);
    }

    wasmBufferFree(buf);
    wasmBufferFree(result);
    return slice.slice(1);
}

// Decodes the svm encoded call account data
export function decodeCallData(bytes: Uint8Array): JSON {
    const data = binToString(bytes);
    const buf = newWasmBuffer({ data: data });
    const result = call("wasm_decode_call", buf);
    const json = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return json;
}

// Encodes data provided in object and returns the encoded data in a json object
export function encodeInput(object: any) : JSON {
    const buf = newWasmBuffer(object);
    const result = call("wasm_encode_inputdata", buf);
    const encoded = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return encoded;
}

// Decode svm data provided in encodedData value and returns a json object of the data
export function decodeInput(encodedData: any) : JSON {
    const buf = newWasmBuffer(encodedData);
    const result = call("wasm_decode_inputdata", buf);
    const json = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return json;
}

// Encodes binary provided binary data as a hex binary string (without an 0x prefix)
export function binToString(array: Uint8Array) : string {
    let result = "";

    for (const b of array) {
        // toString takes no arg????
        let s = b.toString(16);

        // padding
        if (s.length < 2) {
            s = "0" + s;
        }
        result += s;
    }

    return result;
}


///// Internal help functions below

// Call an svm_codec function with the provided buffer. Returns result buffer.
function call(funcName: string, buf) {
    return (codec!.exports as any)[funcName](buf)
}

// Allocates a svm_codec buffer with the provided byte length
function wasmBufferAlloc(length: number) {
    return (codec!.exports as any).wasm_alloc(length)
}

// Frees an allocated svm_codec buffer that was previously allocated by svm_codec
function wasmBufferFree(buf) {
    return (codec!.exports as any).wasm_free(buf);
}

// Returns the bytes length of a wasm_codec buffer
function wasmBufferLength(buf) {
    return (codec!.exports as any).wasm_buffer_length(buf);
}

// Frees the data allocated in a svm_codec buffer
function wasmBufferDataPtr(buf) {
    return (codec!.exports as any).wasm_buffer_data(buf);
}

// Copies binary data from buf to an svm_codec memory buffer
function copyToWasmBufferData(buf, data) {
    let ptr = wasmBufferDataPtr(buf);
    let memory = (codec!.exports as any).memory.buffer;
    let view = new Uint8Array(memory);
    view.set([...data], ptr);
}

// Copies length bytes at an offset from buf to an svm_codec memory buffer
function wasmBufferDataSlice(buf, offset, length: number) {
    let ptr = wasmBufferDataPtr(buf);
    const memory = (codec!.exports as any).memory.buffer;
    const view = new Uint8Array(memory);
    return view.slice(ptr + offset, ptr + offset + length);
}

// Creates a wasm buffer that can be passed to an svm_codec instance methods from a provided json object
// Returns the buffer
function newWasmBuffer(object: any) {
    const objectStr = JSON.stringify(object);
    const bytes = new TextEncoder().encode(objectStr);
    const buf = wasmBufferAlloc(bytes.length);

    if (bytes.length !== wasmBufferLength(buf)) {
        throw new Error("svm codec error: unexpected buf length")
    }

    copyToWasmBufferData(buf, bytes);
    return buf;
}


// Returns a json object of a provided wasm buffer
// Todo: write test
// @ts-ignore
function loadWasmBuffer(buf) : any {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    const string = new TextDecoder().decode(slice);
    return JSON.parse(string);
}


// Returns a utf-8 string representation of the data in an svm_codec buffer
function loadWasmBufferDataAsString(buf) : string {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    if (slice[0] !== OK_MARKER) {
        throw loadWasmBufferError(buf)
    }

    return new TextDecoder().decode(slice.slice(1));
}


// Returns a json object representation of the data in a svm_codec buffer
// Throws an exception if buffer has an error with the exception's string representation
function loadWasmBufferDataAsJson(buf) : JSON {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);

    if (slice[0] === ERR_MARKER) {
        throw loadWasmBufferError(buf);
    }

    const string = loadWasmBufferDataAsString(buf);

    return JSON.parse(string);
}

// Returns a utf-8 string representation of an error in an svm_codec buffer
function loadWasmBufferError(buf) {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    // assert.strictEqual(slice[0], ERR_MARKER);
    return new TextDecoder().decode(slice.slice(1));
}


