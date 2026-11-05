# GUN ARENA

Three.js + Node.js(WebSocket) のオンライン3D銃撃戦。ルームコードで友達と対戦（最大8人 / 15キルで勝利）。

## ローカルで遊ぶ
```bash
npm install
npm start      # http://localhost:3000
```
2つのタブを開き、片方で「ルームを作る」→ 表示された4文字コードをもう片方に入力。

## GitHub に上げる
```bash
git init && git add . && git commit -m "GUN ARENA"
git branch -M main
git remote add origin https://github.com/<you>/gun-arena.git
git push -u origin main
```

## Render にデプロイ
1. Render ダッシュボード → **New → Blueprint**（`render.yaml` を自動検出）または **New → Web Service**
2. リポジトリを選択。Build: `npm install` / Start: `npm start`
3. 発行された `https://xxxx.onrender.com` を友達に共有（WebSocketは自動で wss になります）

※ 無料プランは15分アクセスが無いとスリープし、再開に約1分かかります。

## 操作
WASD 移動 / Shift ダッシュ / Space ジャンプ / マウス 視点 / 左クリック 射撃 / 右クリック エイム / R リロード / E 宝箱 / 1-3 武器スロット / 4 シールドセル / 5 メディキット / ホイール 武器切替
