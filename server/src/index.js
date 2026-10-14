const { createApp } = require('./app');

const port = Number(process.env.PORT || 3001);

createApp().listen(port, () => {
  console.log(`Shelfwise API listening on http://localhost:${port}`);
});
