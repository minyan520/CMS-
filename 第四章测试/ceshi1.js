//切换到文件所在目录
process.chdir(__dirname);

const titbit = require('titbit');
const fs = require('fs');

//检测如果数据目录不存在则创建
try {
  fs.accessSync('./mdata', fs.constants.F_OK);
} catch (err) {
  fs.mkdirSync('mdata');
}

//检测如果数据文件不存在则创建
try {
  fs.accessSync('./mdata/mydata', fs.constants.F_OK);
} catch (err) {
  fs.writeFileSync('./mdata/mydata', '你好，这是我的第一个最小CMS', {encoding: 'utf8'});
}

var app = new titbit({
  debug: true,
  globalLog: true
});

//格式化主页
function fmtHomePage(d) {
  return `<!DOCTYPE html><html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <title>我的CMS</title>
        <link href="https://cdn.bootcss.com/foundation/6.6.1/css/foundation.min.css" rel="stylesheet">
      </head>
      <body>
        <div class="full-container">
          <div class="grid-x" style="padding: 0.8rem;">
            <div class="cell medium-1 large-2"></div>
            <div class="cell medium-10 large-8">${d}</div>
            <div class="cell medium-1 large-2"></div>
          </div>
        </div>
      </body>
    </html>`;
}

app.get('/', async c => {
  try {
    let data = await c.helper.readFile('./mdata/mydata');
    c.res.body = fmtHomePage(data);
  } catch (err) {
    c.status(500);
    c.res.body = '出现错误，请稍候再试';
  }
});

app.run(8008);