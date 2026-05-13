const { app, WebContentsView, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow();
  console.log("WebContentsView exists:", !!WebContentsView);
  console.log("win.contentView exists:", !!win.contentView);
  app.quit();
});
