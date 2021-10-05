export const OK_MARKER = 1;
export const ERR_MARKER = 0;

let codec: WebAssembly.Instance;

// Init the library with the binary content of a .wasm file.
// This function must be called once per client prior to use of any other package functions.
export async function init(code: BufferSource) : Promise<void> {
    const wasm = await WebAssembly.compile(code);
    codec = await WebAssembly.instantiate(wasm, {})
}

// Returns true iff library was initialized with Wasm code
export function isInitialized() : boolean {
    return (codec !== undefined)
}

// User input to the encodeSpawnData function
export interface Spawn {
    version: number,
    template: string,
    name: string
    ctor_name: string,
    calldata: Uint8Array,
}

// User input to the encodeCallData function
export interface Call {
    version: number,
    target: string,
    func_name: string,
    verifydata: Uint8Array,
    calldata: Uint8Array,
}


// Encodes the provided spawn app data
export function encodeSpawn(data: Spawn) : Uint8Array {
    const buf = newWasmBuffer(data);
    const result = call("wasm_encode_spawn", buf);
    const len = wasmBufferLength(result);
    const slice = wasmBufferDataSlice(result, 0, len);

    let errMessage = (slice[0] !== OK_MARKER) ? loadWasmBufferError(result) : "";

    wasmBufferFree(buf);
    wasmBufferFree(result);

    if (errMessage.length > 0) {
        throw errMessage;
    }

    return slice.slice(1);
}

// Decodes the provided SVM encoded spawn data
export function decodeSpawn(data: Uint8Array) : JSON {
    const buf = newWasmBuffer({data: binToString(data)});
    const result = call("wasm_decode_spawn", buf);
    const json = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return json;
}

// Encodes the provided call account data
export function encodeCall(data:Call) : Uint8Array {
    const buf = newWasmBuffer(data);
    const result = call("wasm_encode_call", buf);
    const len = wasmBufferLength(result);
    const slice = wasmBufferDataSlice(result, 0, len);

    let errMessage = (slice[0] !== OK_MARKER) ? loadWasmBufferError(result) : "";

    wasmBufferFree(buf);
    wasmBufferFree(result);

    if (errMessage.length > 0) {
        throw errMessage;
    }

    return slice.slice(1);
}

// Decodes the SVM encoded call account data
export function decodeCall(bytes: Uint8Array): JSON {
    const buf = newWasmBuffer({ data: binToString(bytes) });
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

// Decode SVM data provided in encodedData value and returns a json object of the data
export function decodeInput(encodedData: any) : JSON {
    const buf = newWasmBuffer(encodedData);
    const result = call("wasm_decode_inputdata", buf);
    const json = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return json;
}

// Frees an allocated svm_codec buffer that was previously allocated and returned to caller by an api function
export function wasmBufferFree(buf) : void {
    return (codec.exports as any).wasm_free(buf);
}

// internal helper functions

// Encodes binary provided binary data as a hex binary string (without an 0x prefix)
function binToString(array: Uint8Array) : string {
    let result = "";
    for (const b of array) {
        let s = b.toString(16);

        // padding
        if (s.length < 2) {
            s = "0" + s;
        }
        result += s;
    }
    return result;
}

// Call an svm_codec function with the provided buffer. Returns result buffer.
function call(funcName: string, buf) : Uint8Array {
    if (codec === undefined) {
        throw new Error("Svm codec library is not initialized.");
    }
    return (codec.exports as any)[funcName](buf)
}

// Allocates a svm_codec buffer with the provided byte length
function wasmBufferAlloc(length: number) {
    return (codec.exports as any).wasm_alloc(length)
}

// Returns the bytes length of a wasm_codec buffer
function wasmBufferLength(buf) {
    return (codec.exports as any).wasm_buffer_length(buf);
}

// Frees the data allocated in a svm_codec buffer
function wasmBufferDataPtr(buf) {
    return (codec.exports as any).wasm_buffer_data(buf);
}

// Copies binary data from buf to an svm_codec memory buffer
function copyToWasmBufferData(buf, data) {
    const ptr = wasmBufferDataPtr(buf);
    const memory = (codec.exports as any).memory.buffer;
    const view = new Uint8Array(memory);
    view.set([...data], ptr);
}

// Copies length bytes at an offset from buf to an svm_codec memory buffer
function wasmBufferDataSlice(buf, offset, length: number) {
    const ptr = wasmBufferDataPtr(buf);
    const memory = (codec.exports as any).memory.buffer;
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

// Returns a utf-8 string representation of the data in an svm_codec buffer
function loadWasmBufferDataAsString(buf) : string {
    const length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    if (slice[0] !== OK_MARKER) {
        throw loadWasmBufferError(buf)
    }

    return new TextDecoder().decode(slice.slice(1));
}


// Returns a json object representation of the data in a svm_codec buffer
// Throws an exception if buffer has an error with the exception's string representation
function loadWasmBufferDataAsJson(buf) : JSON {
    const length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);

    if (slice[0] === ERR_MARKER) {
        throw loadWasmBufferError(buf);
    }

    const string = loadWasmBufferDataAsString(buf);

    return JSON.parse(string);
}

// Returns a utf-8 string representation of an error in an svm_codec buffer
function loadWasmBufferError(buf) : string {
    const length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    if (slice[0] !== ERR_MARKER) {
        return "wasm buffer doesn't have an error."
    }

    return new TextDecoder().decode(slice.slice(1));
}
