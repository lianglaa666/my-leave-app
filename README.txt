個人調休假計算機｜iPhone PWA 版

這是把原本 Python + Tkinter 版本改寫成手機網頁 App（PWA）的版本。

包含：
1. 年度特休
2. 一般加班／補休
3. 國定假日補休
4. 平日休／假日休
5. 2026 國定假日自動判定（沿用原 Python 程式中的日期）
6. 新增、刪除、統計、總額計算
7. localStorage 自動儲存
8. JSON 匯出／匯入，可移轉原 Windows 版 leave_data.json

iPhone 使用：
1. 將整個資料夾放到 HTTPS 網站，例如 GitHub Pages、Netlify 或自己的網站。
2. 用 iPhone Safari 開啟該網址。
3. 使用 Safari 的「分享」→「加入主畫面」。
4. 開啟後會以獨立視窗模式使用。

注意：
- PWA 的安裝／離線快取通常需要 HTTPS 網站環境。
- 資料預設儲存在該 iPhone 的瀏覽器本機，不會自動與 Windows 或其他手機同步。
- 建議定期使用「匯出備份 JSON」。
