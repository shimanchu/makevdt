import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { compileSources } from './compile.mjs';

const directory = compileSources(['vdt']);
const { calculateLayout, writeFrameImage, writeFrameAudio } = await import(
    pathToFileURL(path.join(directory, 'vdt.js')).href
);
const options = { comment: '', timeScale: 5, adpcmRate: 4, fileNum: 2, resize: false };

// Characterize the legacy allocation, including its known mismatch with the header.
for (const [timeScale, adpcmRate, voiceSize, actualHeaderSize, bufferSize] of [
    [5, 4, 650, 31402, 94142],
    [12, 4, 1560, 32312, 95962],
    [2, 3, 130, 30882, 93102],
    [5, 0, 0, 30752, 92842],
]) {
    test(`calculateLayout: legacy sizes for time scale ${timeScale}, rate ${adpcmRate}`, () => {
        const layout = calculateLayout({ ...options, timeScale, adpcmRate });
        assert.equal(layout.voiceSize, voiceSize);
        assert.equal(layout.headerSize, 31402);
        assert.equal(layout.actualHeaderSize, actualHeaderSize);
        assert.equal(layout.bufferSize, bufferSize);
    });
}

test('calculateLayout: uses Shift_JIS byte length for Japanese comments', () => {
    const layout = calculateLayout({ ...options, comment: 'テスト' });
    assert.deepEqual(layout.convertedCommentBuffer, Buffer.from([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]));
    assert.equal(layout.headerSize, 31408);
    assert.equal(layout.actualHeaderSize, 31408);
    assert.equal(layout.bufferSize, 94148);
});

test('writeFrameImage: writes row order at the supplied offset without touching surrounding bytes', () => {
    const bytes = Buffer.alloc(30724, 0xaa);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const image = {
        getPixel: (x, y) => (y === 0 ? (x === 0 ? [255, 0, 0] : [0, 255, 0]) : [0, 0, 255]),
    };
    assert.equal(writeFrameImage(view, 2, image, false), 30722);
    const expected = Buffer.alloc(30724, 0xaa);
    expected.writeUInt16BE(0x07c0, 2);
    for (let i = 4; i < 258; i += 2) expected.writeUInt16BE(0xf800, i);
    for (let i = 258; i < 30722; i += 2) expected.writeUInt16BE(0x003e, i);
    assert.deepEqual(bytes, expected);
});

test('writeFrameImage: resize samples source coordinates including the final row and column', () => {
    const samples = [];
    const image = {
        getWidth: () => 256,
        getHeight: () => 240,
        getPixel: (x, y) => {
            samples.push([x, y]);
            return [0, 0, 0];
        },
    };
    writeFrameImage(new DataView(new ArrayBuffer(30720)), 0, image, true);
    assert.equal(samples.length, 15360);
    assert.deepEqual(
        [samples[0], samples[1], samples[127], samples[128], samples.at(-1)],
        [
            [0, 0],
            [2, 0],
            [254, 0],
            [0, 2],
            [254, 238],
        ],
    );
});

// Short/empty audio expectations record current behavior, not a padding specification.
for (const [name, input, audioOffset, voiceSize, copied, nextAudioOffset] of [
    ['remaining audio', [0x11, 0x22, 0x33, 0x44], 1, 2, [0x22, 0x33], 3],
    ['exact remaining length', [0x11, 0x22, 0x33], 1, 2, [0x22, 0x33], 3],
    ['short audio (legacy)', [0x11, 0x22], 1, 3, [0x22], 2],
    ['empty audio (legacy)', [], 0, 3, [], 0],
]) {
    test(`writeFrameAudio: ${name}`, () => {
        const bytes = Buffer.alloc(8, 0xaa);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const result = writeFrameAudio(view, 2, Buffer.from(input), audioOffset, voiceSize);
        assert.deepEqual(result, { offset: 2 + copied.length, adpcmOffset: nextAudioOffset });
        const expected = Buffer.alloc(8, 0xaa);
        expected.set(copied, 2);
        assert.deepEqual(bytes, expected);
    });
}
