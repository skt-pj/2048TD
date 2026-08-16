# 2048TD

2048 とタワーディフェンスを組み合わせた Android 向けプロトタイプです。

## ゲーム仕様

- 画面下の 4x4 盤面を上下左右へスワイプして 2048 を進めます。
- 敵は画面上部の戦場を右から左へリアルタイムで進みます。
- 攻撃は約 0.9 秒ごとに自動発射されます。
- 定期火力は最大タイルと盤面合計から計算され、盤面を育てるほど上昇します。
- 敵が拠点へ到達すると拠点 HP が減少します。
- 拠点 HP が 0 になるか、2048 盤面が詰まるとゲームオーバーです。

## Android 構成

- Kotlin
- Jetpack Compose
- minSdk 23
- targetSdk / compileSdk 36
- Android Gradle Plugin 8.13.2
- Gradle 8.13
- JDK 17

## Android Studio で実行

1. このリポジトリを clone します。
2. Android Studio でリポジトリ直下を開きます。
3. JDK 17 と Android SDK 36 を設定します。
4. `app` を実機または Emulator で実行します。

このリポジトリには GitHub Actions の Android CI も含まれています。CI では単体テストを実行した後、debug APK を生成して `2048TD-debug-apk` artifact として保存します。

## オンラインランキングサーバー

Cloudflare Workers + D1 のランキング API は [`2048TD-ranking`](./2048TD-ranking/) にあります。セットアップ、migration、テスト、ローカル起動、本番 deploy、API の利用例は同ディレクトリの README を参照してください。

## コマンドラインビルド

Gradle 8.13 が PATH にある環境では次で確認できます。

```bash
gradle :app:testDebugUnitTest :app:assembleDebug
```

生成 APK:

```text
app/build/outputs/apk/debug/app-debug.apk
```
