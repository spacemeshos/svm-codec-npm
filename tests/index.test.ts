import fs from 'fs';
import Path from 'path';

import * as SvmCodec from '../dist';

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

async function init() : Promise<void> {
    const path = Path.resolve(__dirname, 'svm_codec.wasm');
    const code = fs.readFileSync(path);
    await SvmCodec.init(code);
}

// tests

describe("SvmCodec Lib", () => {
    it("Inits wasm lib", async () => {
        expect(SvmCodec.isInitialized()).toEqual(false);
        await init()
        expect(SvmCodec.isInitialized()).toEqual(true);
    });
});


describe("Encode InputData", function () {

    // helper function
    async function testInputData(abi: Array<string>, data: Array<number>) {
        const calldata = {
            abi: abi,
            data: data,
        };

        const encoded = SvmCodec.encodeInput(calldata);
        const decoded = SvmCodec.decodeInput(encoded);

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

describe("Spawn Account", function () {

    /// spawn helper
    function encodeSpawn(template: string, name: string, callData: Uint8Array) : Uint8Array {
        const data : SvmCodec.Spawn = {
            version: 0,
            template: template,
            name: name,
            ctor_name: "initialize",
            calldata: callData
        };

        return SvmCodec.encodeSpawn(data);
    }

    it("Encodes & Decodes valid transactions", async function () {
        await init();
        const template = generateAddress("1020304050");
        const name = "My Account";
        const object = {
            abi: ["i32", "i64"],
            data: [10, 20],
        };
        const callData: JSON = SvmCodec.encodeInput(object);
        const bytes = encodeSpawn(template, name, callData["data"])
        const json = SvmCodec.decodeSpawn(bytes);
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

        expect(() => {encodeSpawn("102030", "", new Uint8Array(0))})
            .toThrow("The value of a specific field is invalid (`template`).");
    });
});

////////////////

describe("Call Account", function () {
    function encodeCall(target: string, verifyData: Uint8Array, callData: Uint8Array) : Uint8Array {
        const data : SvmCodec.Call = {
            version: 0,
            target: target,
            func_name: "do_something",
            verifydata: verifyData,
            calldata: callData,
        };
        return SvmCodec.encodeCall(data);
    }

    it("Encodes & Decodes valid transaction", async function () {

        await init();

        const target = generateAddress("1020304050");

        const verifyData = SvmCodec.encodeInput( {
            abi: ["bool", "i8"],
            data: [true, 5],
        });

        const callData = SvmCodec.encodeInput( {
            abi: ["i32", "i64"],
            data: [10, 20],
        });

        const data = encodeCall(
            target,
            verifyData["data"],
            callData["data"]
        );

        const json = SvmCodec.decodeCall(data);

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

        expect(() =>
        {encodeCall("102030", new Uint8Array(), new Uint8Array())})
            .toThrow("The value of a specific field is invalid (`target`).");
    });
});
