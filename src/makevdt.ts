import cliProgress from 'cli-progress';
import fs from 'fs';
import { Command } from 'commander';
import PNGReader from 'png.js';
import { buildVdt, type FrameImage, type VdtOptions } from './vdt.js';

async function main() {
    const program = new Command();
    program
        .description('Make vdt file')
        .requiredOption('-p, --prefix <prefix>', 'input file prefix')
        .requiredOption('-n, --file-num <fileNum>', 'number of input files', (value) => parseInt(value, 10))
        .requiredOption('-t, --time-scale <timeScale>', 'time scale (60/30/20/15/12/10/6/5/4/3/2)', (value) =>
            parseInt(value, 10),
        )
        .requiredOption('-a, --adpcm <adpcm>', 'ADPCM filename')
        .requiredOption('-o, --outfile <outfile>', 'output filename')
        .option('-c, --comment <comment>', 'comment', '')
        .option('--digits <digits>', 'input file digits', (value) => parseInt(value, 10), 4)
        .option(
            '--adpcm-rate <adpcmRate>',
            'ADPCM rate (0(no audio)/3(7.8KHz)/4(15.6KHz))',
            (value) => parseInt(value, 10),
            4,
        )
        .option('--no-resize', 'do not resize image')
        .option('--poster-image <posterImage>', 'poster image filename', '')
        .showHelpAfterError(true)
        .parse(process.argv);

    const options = program.opts<
        VdtOptions & { prefix: string; digits: number; adpcm: string; outfile: string; posterImage: string }
    >();

    const readImage = async (filename: string): Promise<FrameImage> => {
        const buffer = await fs.promises.readFile(filename);
        return await new Promise((resolve, reject) => {
            new PNGReader(buffer).parse((error, png) => {
                if (error) reject(error);
                else resolve(png);
            });
        });
    };
    const poster = options.posterImage ? await readImage(options.posterImage) : undefined;
    fs.statSync(options.adpcm);
    const audio = fs.readFileSync(options.adpcm);
    const progressBar = new cliProgress.SingleBar(
        { format: ' {bar} {percentage}% | ETA: {eta}s | {value}/{total} frames processed', hideCursor: true },
        cliProgress.Presets.shades_classic,
    );
    progressBar.start(options.fileNum, 0);
    const dataView = await buildVdt(options, {
        audio,
        poster,
        readFrame: async (i) =>
            await readImage(options.prefix + ('0'.repeat(options.digits) + i).slice(-options.digits) + '.png'),
        onFrameProcessed: (i) => {
            if (i % (60 / options.timeScale) === 0 || i === Number(options.fileNum)) progressBar.update(i);
        },
    });
    progressBar.stop();
    fs.writeFile(options.outfile, dataView, (err: NodeJS.ErrnoException | null) => {
        if (err) throw err;
        console.log(`Output to ${options.outfile}`);
    });
}

await main();
