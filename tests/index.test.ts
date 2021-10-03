import {svmCodec} from "../dist";

// test helper functions

function repeatString(s: string, byteLength: number) : string {
    const n = s.length;
    const t = byteLength * 2;
    expect(t % n).toEqual(0);
    const m = t / n;
    return s.repeat(m);
}

function generateAddress(s: string) : string {
    return repeatString(s, 20);
}

// Encodes binary data provided in array as a hex binary string (without an 0x prefix)
function binToString(array: Uint8Array) : string {
    let result = "";
    array.forEach((b) => {
        // toString takes no arg????
        let s = b.toString(16);

        // padding
        if (s.length < 2) {
            s = "0" + s;
        }
        result += s;
    });

    return result;
}

async function init() {
    const fs = require('fs');
    const Path = require('path');
    const path = Path.resolve(__dirname, 'svm_codec.wasm');
    const code = fs.readFileSync(path)
    await svmCodec.init(code)
}

/// tests

describe("SvmCodec Lib", () => {
    it("Inits wasm lib", async () => {
        await init()
        expect(svmCodec.isInitialized()).toEqual(true);
    });
});

describe("WASM Buffer", () => {
    it("Allocate & free", async () => {
        await init()
        const object = {
            message: "Hello World",
            status: 200,
        };

        const buf = svmCodec.newWasmBuffer(object);
        const loaded = svmCodec.loadWasmBuffer(buf);
        expect(loaded).toEqual(object);

        svmCodec.wasmBufferFree(buf);

        //expect(sum(1, 1)).toEqual(2);
    });
});


//////////////

describe("Encode InputData", function () {

    // helper function
    async function testInputData(abi: Array<string>, data: Array<number>) {
        const calldata = {
            abi: abi,
            data: data,
        };

        const encoded = svmCodec.encodeInput(calldata);
        const decoded = svmCodec.decodeInput(encoded);

        expect(decoded).toStrictEqual(calldata);
    }

    it("i8", async function () {
        await init();
        await testInputData(["i8"], [-10]);

    });

    it("u8", async function () {
        await init();
        await testInputData(["u8"], [10]);

    });

    it("i16", async function () {
        await init();
        await testInputData(["i16"], [-10]);
    });

    it("u16", async function () {
        await init();
        await testInputData(["u16"], [10]);
    });

    it("i32", async function () {
        await init();
        await testInputData(["i32"], [-10]);
    });

    it("u32", async function () {
        await init();
        await testInputData(["u32"], [10]);
    });

    it("amount", async function () {
        await init();
        await testInputData(["amount"], [10]);
    });
});

/////////////////

describe("Deploy Template", function () {
    it("Encodes & Decodes valid transactions", async function () {
        await init();

        const tx = {
            svm_version: 1,
            code_version: 2,
            name: "My Template",
            desc: "A few words",
            code: "C0DE",
            data: "0000000100000003",
            ctors: ["init", "start"],
        };

        const buf = svmCodec.newWasmBuffer(tx);
        const result = svmCodec.call("wasm_encode_deploy", buf);
        const len = svmCodec.wasmBufferLength(result);
        const slice = svmCodec.wasmBufferDataSlice(result, 0, len);
        expect(slice[0]).toStrictEqual(svmCodec.OK_MARKER);

        // `bytes` is a `Uint8Array` holding the encoded `SVM spawn-account` transaction
        //const bytes = slice.slice(1);

        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);
    });

    it("Handles errors for invalid transactions", async function () {

        await init();
        const tx = {
            svm_version: 1,
            code_version: 2,
        };

        const buf = svmCodec.newWasmBuffer(tx);
        const result = svmCodec.call("wasm_encode_deploy", buf);

        const error = svmCodec.loadWasmBufferError(result);
        expect(error).toStrictEqual("A non-optional field was missing (`name`).");

        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);
    });
});

////////////

describe("Spawn Account", function () {

    /// spawn helper
    function encodeSpawn(template: string, name: string, calldata: Uint8Array) : Uint8Array {
        const tx = {
            version: 0,
            template: template,
            name: name,
            ctor_name: "initialize",
            calldata: calldata,
        };
        const buf = svmCodec.newWasmBuffer(tx);
        const result = svmCodec.call("wasm_encode_spawn", buf);
        const len = svmCodec.wasmBufferLength(result);
        const slice = svmCodec.wasmBufferDataSlice(result, 0, len);
        expect(slice[0]).toStrictEqual(svmCodec.OK_MARKER);
        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);
        return slice.slice(1);
    }

    // Span helper
    function decodeSpawn(bytes: Uint8Array) : JSON {
        const data = binToString(bytes);
        const buf = svmCodec.newWasmBuffer({ data: data });
        const result = svmCodec.call("wasm_decode_spawn", buf);
        const json = svmCodec.loadWasmBufferDataAsJson(result);
        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);
        return json;
    }

    it("Encodes & Decodes valid transactions", async function () {
        await init();
        const template = generateAddress("1020304050");
        const name = "My Account";
        const object = {
            abi: ["i32", "i64"],
            data: [10, 20],
        };
        const calldata: JSON = svmCodec.encodeInput(object);
        const bytes = encodeSpawn(template, name, calldata["data"]);
        const json = decodeSpawn(bytes);
        expect(json).toStrictEqual({
            version: 0,
            template: template,
            name: name,
            ctor_name: "initialize",
            calldata: {
                abi: ["i32", "i64"],
                data: [10, 20],
            },
        });
    });

    it("Handles errors for invalid transactions", async function () {
        await init();

        const tx = {
            version: 0,
            template: "102030",
        };

        const buf = svmCodec.newWasmBuffer(tx);
        const result = svmCodec.call("wasm_encode_spawn", buf);
        const error = svmCodec.loadWasmBufferError(result);
        expect(error).toStrictEqual(
            "The value of a specific field is invalid (`template`)."
        );

        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);

    });
});

////////////////

describe("Call Account", function () {
    function encodeCall(target: string, verifydata: Uint8Array, calldata: Uint8Array) : Uint8Array {
        const tx = {
            version: 0,
            target: target,
            func_name: "do_something",
            verifydata: verifydata,
            calldata: calldata,
        };

        const buf = svmCodec.newWasmBuffer(tx);
        const result = svmCodec.call("wasm_encode_call", buf);
        const len = svmCodec.wasmBufferLength(result);
        const slice = svmCodec.wasmBufferDataSlice(result, 0, len);
        expect(slice[0]).toStrictEqual(svmCodec.OK_MARKER);

        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);

        return slice.slice(1);
    }

    function decodeCall(bytes: Uint8Array): JSON {
        const data = binToString(bytes);
        const buf = svmCodec.newWasmBuffer({ data: data });
        const result = svmCodec.call("wasm_decode_call", buf);
        const json = svmCodec.loadWasmBufferDataAsJson(result);
        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);

        return json;
    }

    it("Encodes & Decodes valid transaction", async function () {

        await init();

        const target = generateAddress("1020304050");
        const verifydata = svmCodec.encodeInput( {
            abi: ["bool", "i8"],
            data: [true, 5],
        });
        const calldata = svmCodec.encodeInput( {
            abi: ["i32", "i64"],
            data: [10, 20],
        });
        const bytes = encodeCall(
            target,
            verifydata["data"],
            calldata["data"]
        );

        const json = decodeCall(bytes);

        expect(json).toStrictEqual({
            version: 0,
            target: target,
            func_name: "do_something",
            verifydata: {
                abi: ["bool", "i8"],
                data: [true, 5],
            },
            calldata: {
                abi: ["i32", "i64"],
                data: [10, 20],
            },
        });
    });

    it("Handles errors for invalid transactions", async function () {

        await init();

        const tx = { version: 0, target: "102030" };
        const buf = svmCodec.newWasmBuffer(tx);
        const result = svmCodec.call("wasm_encode_call", buf);
        const error = svmCodec.loadWasmBufferError(result);
        expect(error).toStrictEqual(
            "The value of a specific field is invalid (`target`)."
        );

        svmCodec.wasmBufferFree(buf);
        svmCodec.wasmBufferFree(result);
    });
});