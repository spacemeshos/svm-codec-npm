const OK_MARKER = 1;
const ERR_MARKER = 0;

let codec = null

const assert = require("assert");

// Init the library with the binary content of a .wasm file.
// This function must be called once per client prior to use of any other package functions.
async function init(code) {
    const wasm = await WebAssembly.compile(code);
    codec = await WebAssembly.instantiate(wasm, {})
}

function isInitialized() {
    return (codec !== null)
}

// Call an svm_codec function with the provided buffer. Returns result buffer.
function call(funcName, buf)  {
    return codec.exports[funcName](buf)
}

// Allocates a svm_codec buffer with the provided byte length
function wasmBufferAlloc(length) {
    return codec.exports.wasm_alloc(length)
}

// Frees an allocated svm_codec buffer that was previously allocated by svm_codec
function wasmBufferFree(buf) {
    return codec.exports.wasm_free(buf);
}

// Returns the bytes length of a wasm_codec buffer
function wasmBufferLength(buf) {
    return codec.exports.wasm_buffer_length(buf);
}

// Frees the data allocated in a svm_codec buffer
function wasmBufferDataPtr(buf) {
    return codec.exports.wasm_buffer_data(buf);
}

// Copies binary data from buf to an svm_codec memory buffer
function copyToWasmBufferData(buf, data) {
    let ptr = wasmBufferDataPtr(buf);
    let memory = codec.exports.memory.buffer;
    let view = new Uint8Array(memory);
    view.set([...data], ptr);
}

// Copies length bytes at an offset from buf to an svm_codec memory buffer
function wasmBufferDataSlice(buf, offset, length) {
    let ptr = wasmBufferDataPtr(buf);
    const memory = codec.exports.memory.buffer;
    const view = new Uint8Array(memory);
    return view.slice(ptr + offset, ptr + offset + length);
}

// Creates a wasm buffer that can be passed to an svm_codec instance methods from a provided json object
// Returns the buffer
function newWasmBuffer(object) {
    const objectStr = JSON.stringify(object);
    const bytes = new TextEncoder().encode(objectStr);
    const buf = wasmBufferAlloc(bytes.length);
    assert.strictEqual(bytes.length, wasmBufferLength(buf));
    copyToWasmBufferData(buf, bytes);
    return buf;
}

// Returns a json object of a provided wasm buffer
function loadWasmBuffer(buf) {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    const string = new TextDecoder().decode(slice);
    return JSON.parse(string);
}

// Returns a utf-8 string representation of the data in an svm_codec buffer
function loadWasmBufferDataAsString(buf) {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);
    assert.strictEqual(slice[0], OK_MARKER);
    return new TextDecoder().decode(slice.slice(1));
}

// Returns a json object representation of the data in a svm_codec buffer
// Throws an exception if buffer has an error with the exception's string representation
function loadWasmBufferDataAsJson(buf) {
    let length = wasmBufferLength(buf);
    const slice = wasmBufferDataSlice(buf, 0, length);

    if (slice[0] === ERR_MARKER) {
        const msg = loadWasmBufferError(buf);
        console.warn(msg);
        throw msg;
    }

    assert.strictEqual(slice[0], OK_MARKER);

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

// Encodes data provided in josn object and returns the encoded data in a json object
function encodeInput(object) {
    const buf = newWasmBuffer(object);
    const result = call("wasm_encode_inputdata", buf);
    const encoded = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return encoded;
}

// Decode svm data provided in encodedData json object and returns a json object of the decoded data
function decodeInput(encodedData) {
    const buf = newWasmBuffer(encodedData);
    const result = call("wasm_decode_inputdata", buf);
    const json = loadWasmBufferDataAsJson(result);
    wasmBufferFree(buf);
    wasmBufferFree(result);
    return json;
}

module.exports.svmCodec = {
    isInitialized,
    init,
    call,
    wasmBufferAlloc,
    wasmBufferFree,
    wasmBufferLength,
    wasmBufferDataSlice,
    loadWasmBufferDataAsString,
    loadWasmBufferError,
    loadWasmBuffer,
    copyToWasmBufferData,
    newWasmBuffer,
    loadWasmBufferDataAsJson,
    encodeInput,
    decodeInput,
    OK_MARKER,
    ERR_MARKER
};