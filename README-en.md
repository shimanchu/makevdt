# makevdt

## Summary
This tool creates a VDT file (a video format used in X680x0) from video files such as MP4.

## Installation
```bash
$ git clone https://github.com/shimanchu/makevdt.git
$ cd makevdt
$ npm i
```

# Steps to create a VDT file

## 1. Prepare the video file
Any format of the video file can be used, but those with an aspect ratio closer to 4:3 are recommended.

## 2. Extract image files from the video file
Using ffmpeg, extract image files (PNG) of each frame from the video file prepared in step 1. Depending on the frame rate of the VDT file you want to create, specify the value of the -r option. The following is an example when the frame rate is 12 frames per second.

```bash
ffmpeg -i input.mp4 -vcodec png -r 12 image_%04d.png
```

## 3. Extract audio data from the video file and convert it to an ADPCM file
Using ffmpeg, extract audio data from the video file prepared in step 1 as a WAV file (15.6KHz, mono).

```bash
ffmpeg -i input.mp4 -vn -ar 15625 -ac 1 -f wav audio.wav
```
Next, use various free software to convert the WAV file to an ADPCM file for X68k. Since it takes a long time to convert on X68k, it is recommended to execute it with the MPU set to no-wait on an emulator such as XM6.

### If using [pcm3pcm](https://www.vector.co.jp/soft/dl/x68/art/se019752.html) (executed on X68k)
```dos
pcm3pcm.x audio.wav audio.pcm
```

### If using [PCMCONV](https://www.vector.co.jp/soft/x68/art/se031966.html) (executed on X68k)
```dos
PCMCONV.X -ir15625 -or0 -if2 -of8 audio.wav audio.pcm
```

### If using [PCMCONV](https://www.vector.co.jp/soft/x68/art/se031966.html) (executed on Windows via [MS-DOS Player for Win32-x64](http://takeda-toshiya.my.coocan.jp/))
```dos
MSDOS PCMCONV.EXE -ir15625 -or0 -if2 -of8 audio.wav audio.pcm
```

## 4. Execute makevdt to create a VDT file
Input the image files created in step 2 and the ADPCM file created in step 3 to makevdt and output the VDT file.

```bash
node makevdt.js -p image_ -n 1000 -t 5 -a audio.pcm -o output.vdt
```

The meaning of each option is as follows:

|Option|Required|Meaning|
|-|-|-|
|-p, --prefix|\*|Prefix of the image files|
|-n, --file-num|\*|Number of image files|
|-t, --time-scale|\*|How many frames to play per certain frames<br>Example: every 12 frames per second => 5 |
|-a, --adpcm|\*|ADPCM file|
|-o, --outfile|\*|Output VDT file|
|-c, --comment|-|Comment to include in the VDT file (default: "")|
|--digits|-|Number of digits in the sequential number of image files (default: 4)|
|--adpcm-rate|-|ADPCM rate (0: no sound, 3: 7.8KHz, 4: 15.6KHz） (default: 4)|
|--no-resize|-|Do not resize image files (default: resize)|

# Others

- The specification of the VDT data was referred to SIV_VDT.TXT of [SivPack](https://www.vector.co.jp/soft/x68/art/se027692.html).
