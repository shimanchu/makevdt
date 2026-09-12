import iconv from 'iconv-lite';

export interface VdtOptions {
    comment: string;
    timeScale: number;
    adpcmRate: number;
    fileNum: number;
    resize: boolean;
}

export interface FrameImage {
    getPixel(x: number, y: number): number[];
    getWidth(): number;
    getHeight(): number;
}

export interface VdtInputs {
    audio: Buffer;
    poster?: FrameImage;
    readFrame(frameNumber: number): Promise<FrameImage>;
    onFrameProcessed?(frameNumber: number): void;
}

// Fixed parameters
const frameLength = 30720;
const frameWidth = 128;
const frameHeight = 120;
const isLittleEndian = false;

export function calculateLayout(options: VdtOptions) {
    let adpcmRateHz = 0;
    switch (options.adpcmRate) {
        case 3:
            adpcmRateHz = 7800;
            break;
        case 4:
            adpcmRateHz = 15600;
            break;
    }
    const convertedCommentBuffer = iconv.encode(options.comment, 'Shift_JIS');
    const headerSize = 0x7aaa + convertedCommentBuffer.length;
    const voiceSize = adpcmRateHz / 2 / (60 / options.timeScale);
    const bufferSize = headerSize + options.fileNum * (frameLength + voiceSize);

    // Preserve the legacy allocation independently of the serialized header length.
    const actualHeaderSize = 30752 + convertedCommentBuffer.length + Math.ceil(voiceSize);
    return { convertedCommentBuffer, headerSize, actualHeaderSize, voiceSize, bufferSize };
}

export function writeFrameImage(dataView: DataView, offset: number, png: FrameImage, resize: boolean): number {
    for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < frameWidth; x++) {
            const pixel = resize
                ? png.getPixel(
                      Math.round((x / frameWidth) * png.getWidth()),
                      Math.round((y / frameHeight) * png.getHeight()),
                  )
                : png.getPixel(Math.round(x), Math.round(y));
            const convertedPixel =
                ((pixel[1] >> 3) << 11) | // G
                ((pixel[0] >> 3) << 6) | // R
                ((pixel[2] >> 3) << 1); // B
            dataView.setInt16(offset, convertedPixel, isLittleEndian);
            offset += 2;
        }
    }

    return offset;
}

export function writeFrameAudio(
    dataView: DataView,
    offset: number,
    adpcmBuf: Buffer,
    adpcmOffset: number,
    voiceSize: number,
): { offset: number; adpcmOffset: number } {
    const adpcmSize = adpcmBuf.length;
    // Preserve legacy behavior when audio runs out; padding is a separate change.
    for (let j = 0; j < voiceSize; j++) {
        if (adpcmOffset < adpcmSize) {
            dataView.setUint8(offset, adpcmBuf.readUint8(adpcmOffset));
            adpcmOffset++;
            offset++;
        }
    }
    return { offset, adpcmOffset };
}

export function writeHeader(
    dataView: DataView,
    options: VdtOptions,
    layout: ReturnType<typeof calculateLayout>,
    poster?: FrameImage,
): number {
    const { convertedCommentBuffer, voiceSize } = layout;
    let offset = 0;
    // Output header
    // - SiV
    new TextEncoder().encode('SiV').forEach((byte: number) => {
        dataView.setUint8(offset, byte);
        offset++;
    });
    // - comment
    convertedCommentBuffer.forEach((c: number) => {
        dataView.setUint8(offset, c);
        offset++;
    });
    dataView.setInt8(offset, 0x0a);
    offset++;
    // - poster image size
    dataView.setInt32(offset, frameLength, isLittleEndian);
    offset += 4;
    // - poster image data
    if (poster) {
        offset = writeFrameImage(dataView, offset, poster, options.resize);
    } else {
        for (let y = 0; y < frameHeight; y++) {
            for (let x = 0; x < frameWidth; x++) {
                dataView.setInt16(offset, 0x1234, isLittleEndian);
                offset += 2;
            }
        }
    }

    // - quality
    dataView.setInt32(offset, 1, isLittleEndian);
    offset += 4;
    // - type
    dataView.setInt32(offset, 0, isLittleEndian);
    offset += 4;
    // - poster voice size
    dataView.setInt32(offset, voiceSize, isLittleEndian);
    offset += 4;
    // - poster voice data
    for (let i = 0; i < voiceSize; i++) {
        dataView.setInt8(offset, 0x99);
        offset++;
    }
    // - time scale
    dataView.setInt32(offset, options.timeScale, isLittleEndian);
    offset += 4;
    // - ADPCM rate
    dataView.setInt32(offset, options.adpcmRate, isLittleEndian);
    offset += 4;
    // - frame number
    dataView.setInt32(offset, options.fileNum, isLittleEndian);
    offset += 4;

    return offset;
}

export async function buildVdt(options: VdtOptions, inputs: VdtInputs): Promise<DataView> {
    const layout = calculateLayout(options);
    const dataView = new DataView(new ArrayBuffer(layout.bufferSize));
    let offset = writeHeader(dataView, options, layout, inputs.poster);
    let adpcmOffset = 0;
    for (let i = 1; i <= options.fileNum; i++) {
        const image = await inputs.readFrame(i);
        offset = writeFrameImage(dataView, offset, image, options.resize);
        ({ offset, adpcmOffset } = writeFrameAudio(dataView, offset, inputs.audio, adpcmOffset, layout.voiceSize));
        inputs.onFrameProcessed?.(i);
    }
    return dataView;
}
