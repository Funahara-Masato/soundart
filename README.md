# SoundArt — 音で星を育てる

10秒間マイクで録音するだけで、あなただけの惑星が生まれ、成長していく Web アプリです。
録音のたびに惑星の姿が変化し、あなたの「音の記録」が星になります。

## 概要

- マイクから音声を取得し、Web Audio API でリアルタイムに周波数解析
- 周波数の特徴（音の高さ・強さ・分布）を惑星のパラメータにマッピング
- 録音履歴が積み重なるほど惑星が成長する仕組み
- PWA（Progressive Web App）対応。スマートフォンのホーム画面に追加して使用可能

## 技術スタック

- HTML / CSS / JavaScript（Vanilla）
- Web Audio API（AudioContext・AnalyserNode による周波数解析）
- Canvas API（惑星レンダリング）
- Service Worker（オフライン対応・PWA）

## 実行方法

ローカルサーバーが必要です（Service Worker の制約のため）。

```bash
# Python がある場合
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開き、マイクの使用を許可してください。

## ファイル構成

```
soundart/
├── index.html          # 画面構成（ホーム・録音・生成・結果）
├── app.js              # 画面管理・録音制御・メインロジック
├── style.css           # スタイル定義
├── sw.js               # Service Worker（PWA 対応）
├── manifest.json       # PWA マニフェスト
├── planet/
│   ├── planet-mapper.js    # 周波数データ → 惑星パラメータ変換
│   ├── planet-renderer.js  # Canvas による惑星描画
│   └── planet-state.js     # 惑星の状態管理・永続化
└── share/
    └── share-composer.js   # 結果シェア機能
```

## Author

Masato Funahara  
[github.com/Funahara-Masato](https://github.com/Funahara-Masato)
