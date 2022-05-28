const cliProgress = require('cli-progress');
const fs = require('fs');
const program = require('commander');
const PNGReader = require('png.js');
const Iconv = require('iconv').Iconv;

program
    .description('Make vdt file')
    .requiredOption('-p, --prefix <prefix>', 'input file prefix')
    .requiredOption('-n, --file-num <fileNum>', 'number of input files')
    .requiredOption('-t, --time-scale <timeScale>', 'time scale (60/30/20/15/12/10/6/5/4/3/2)')
    .requiredOption('-a, --adpcm <adpcm>', 'ADPCM filename')
    .requiredOption('-o, --outfile <outfile>', 'output filename')
    .option('-c, --comment <comment>', 'comment', '')
    .option('--digits <digits>', 'input file digits', 4)
    .option('--adpcm-rate <adpcmRate>', 'ADPCM rate (0(no audio)/3(7.8KHz)/4(15.6KHz))', 4)
    .option('--no-resize', 'do not resize image')
    .showHelpAfterError(true)
    .parse(process.argv);

const options = program.opts();
const iconv = new Iconv('UTF-8', 'SHIFT_JIS');
const textEncoder = new TextEncoder();

// Fixed parameters
const frameLength = 30720;
const frameWidth = 128;
const frameHeight = 120;
const isLittleEndian = false;

let adpcmRateHz = 0;
switch (options.adpcmRate) {
case 3:
    adpcmRateHz = 7800;
    break;
case 4:
    adpcmRateHz = 15600;
    break;
}
const convertedCommentBuffer = iconv.convert(options.comment);
const headerSize = 0x7aaa + convertedCommentBuffer.length;
const voiceSize = adpcmRateHz / 2 / (60 / options.timeScale);
const bufferSize = headerSize + options.fileNum * (frameLength + voiceSize);
const dataView = new DataView(new ArrayBuffer(bufferSize));

let offset = 0;
// Output header
// - SiV
dataView.setUint8(offset, textEncoder.encode('S')); offset++;
dataView.setUint8(offset, textEncoder.encode('i')); offset++;
dataView.setUint8(offset, textEncoder.encode('V')); offset++;
// - comment
convertedCommentBuffer.forEach(c => {
    dataView.setUint8(offset, c); offset++;
});
dataView.setInt8(offset, 0x0a, isLittleEndian); offset++;
// - poster image size
dataView.setInt32(offset, frameLength, isLittleEndian); offset += 4;
// - poster image data
for (let y = 0; y < frameHeight; y++) {
    for (let x = 0; x < frameWidth; x++) {
        dataView.setInt16(offset, 0x1234, isLittleEndian); offset += 2;
    }
}
// - quality
dataView.setInt32(offset, 1, isLittleEndian); offset += 4;
// - type
dataView.setInt32(offset, 0, isLittleEndian); offset += 4;
// - poster voice size
dataView.setInt32(offset, voiceSize, isLittleEndian); offset += 4;
// - poster voice data
for (let i = 0; i < voiceSize; i++) {
    dataView.setInt8(offset, 0x99, isLittleEndian); offset++;
}
// - time scale
dataView.setInt32(offset, options.timeScale, isLittleEndian); offset += 4;
// - ADPCM rate
dataView.setInt32(offset, options.adpcmRate, isLittleEndian); offset += 4;
// - frame number
dataView.setInt32(offset, options.fileNum, isLittleEndian); offset += 4;

// promise functions
const readFilePromise = (filename) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (error, buffer) => {
            if (error) reject(error);
            resolve(buffer);
        });
    });
};

const parsePromise = (reader) => {
    return new Promise((resolve, reject) => {
        reader.parse((error, png) => {
            if (error) reject(error);
            resolve(png);
        });
    });
};

// Output image and voice data
(async () => {
    const adpcmSize = fs.statSync(options.adpcm).size;
    const adpcmBuf = fs.readFileSync(options.adpcm);
    let adpcmOffset = 0;
    // Progress bar
    const progressBar = new cliProgress.SingleBar({ format: ' {bar} {percentage}% | ETA: {eta}s | {value}/{total} frames processed', hideCursor: true }, cliProgress.Presets.shades_classic);
    progressBar.start(options.fileNum);
    for (let i = 1; i <= options.fileNum; i++) {
        const pngFilename = options.prefix + ('0'.repeat(options.digits) + i).slice(-options.digits) + '.png';
        const png = await parsePromise(new PNGReader(await readFilePromise(pngFilename)));
        // - frame image data
        for (let y = 0; y < frameHeight; y++) {
            for (let x = 0; x < frameWidth; x++) {
                const pixel = options.resize
                    ? png.getPixel(
                        Math.round(x / frameWidth * png.getWidth()),
                        Math.round(y / frameHeight * png.getHeight()))
                    : png.getPixel(
                        Math.round(x),
                        Math.round(y));
                const converedPixel =
                    (pixel[1] >> 3) << 11 | // G
                    (pixel[0] >> 3) << 6 | // R
                    (pixel[2] >> 3) << 1; // B
                dataView.setInt16(offset, converedPixel, isLittleEndian); offset += 2;
            }
        }

        // - frame voice data
        for (let j = 0; j < voiceSize; j++) {
            if (adpcmOffset < adpcmSize) {
                dataView.setUint8(offset, adpcmBuf.readUint8(adpcmOffset)); adpcmOffset++; offset++;
            }
        }
        if (i % (60 / options.timeScale) === 0 || i === Number(options.fileNum)) {
            progressBar.update(i);
        }
    }
    progressBar.stop();

    // Output to file
    fs.writeFile(options.outfile, dataView, (err) => {
        if (err) throw err;
        console.log(`Output to ${options.outfile}`);
    });
})().catch((error) => {
    console.log(error);
});
