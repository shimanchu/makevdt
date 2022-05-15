# makevdt

## 概要
MP4等の動画ファイルから、VDTファイル（X680x0で使われる動画形式）を作成します。

## インストール
```bash
$ git clone https://github.com/shimanchu/makevdt.git
$ cd makevdt
$ npm i
```

# VDTファイル作成手順

## 1. 動画ファイルの準備
対象とする動画ファイルの形式は何でも良いですが、画面比率が4:3に近いものが良いでしょう。

## 2. 動画ファイルから画像ファイルを抽出
ffmpegを使って、1.の動画ファイルをフレームごとの画像ファイル(PNG)に切り出します。\
最終的に作成したいVDTファイルのフレームレートに応じて、-rオプションの値を指定します。下記は毎秒12コマの場合の例です。

```bash
ffmpeg -i input.mp4 -vcodec png -r 12 image_%04d.png
```

## 3. 動画ファイルから音声データを抽出し、ADPCMファイルに変換

ffmpegを使って、1.の動画ファイルから音声データをWAVファイル（15.6KHz, モノラル）として抽出します。
```bash
ffmpeg -i input.mp4 -vn -ar 15625 -ac 1 -f wav audio.wav
```
次に、各種フリーソフト等を使って、WAVファイルをX68kのADPCMファイルに変換します。\
X68k実機での変換には時間がかかるので、XM6などのエミュレータでMPUをノーウェイトにして実行すると良いでしょう。

### [pcm3pcm](https://www.vector.co.jp/soft/dl/x68/art/se019752.html)を使う場合（X68kで実行）
```dos
pcm3pcm.x audio.wav audio.pcm
```

### [PCMCONV](https://www.vector.co.jp/soft/dos/art/se004506.html)を使う場合（X68kで実行）
```dos
PCMCONV.X -ir15625 -or0 -if2 -of8 audio.wav audio.pcm
```

### [PCMCONV](https://www.vector.co.jp/soft/dos/art/se004506.html)を使う場合（[MS-DOS Player for Win32-x64](http://takeda-toshiya.my.coocan.jp/)経由でWindowsで実行）
```dos
MSDOS PCMCONV.EXE -ir15625 -or0 -if2 -of8 audio.wav audio.pcm
```

## 4. makevdtを使ってVDTファイルを作成
2.で作成した画像ファイル群と、3.で作成したADPCMファイルをmakevdtに入力して、VDTファイルを出力します。

```bash
node makevdt.js -p image_ -n 1000 -t 5 -a audio.pcm -o output.vdt
```

各オプションの意味は以下となります。

|オプション|必須|意味|
|-|-|-|
|-p, --prefix|\*|画像ファイルのプレフィックス|
|-n, --file-num|\*|画像ファイルの数|
|-t, --time-scale|\*|何フレームごとに1フレーム再生するか<br>例：毎秒12コマの場合⇒5 |
|-a, --adpcm|\*|ADPCMファイル|
|-o, --outfile|\*|出力するVDTファイル|
|-c, --comment|-|VDTファイルに含めるコメント (default: "")|
|--digits|-|画像ファイルの連番の桁数 (default: 4)|
|--adpcm-rate|-|ADPCMレート（0: 無音, 3: 7.8KHz, 4: 15.6KHz） (default: 4)|
|--no-resize|-|画像ファイルをリサイズしない (default: リサイズする)|

# その他

- VDTデータの仕様は[SivPack](https://www.vector.co.jp/soft/x68/art/se027692.html)のSIV_VDT.TXTを参照しました
