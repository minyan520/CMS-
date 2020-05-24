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

//检测如果数据目录不存在则创建
try {
  fs.accessSync('./images', fs.constants.F_OK);
} catch (err) {
  fs.mkdirSync('images');
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

//读取images目录下的图片
app.get('/image/:name', async c => {
  var imgfile = `./images/${c.param.name}`;
  try {
    fs.accessSync(imgfile, fs.constants.F_OK);
  } catch (err) {
    c.status(404);
    return ;
  }

  await new Promise((rv, rj) => {
    var fst = fs.createReadStream(imgfile);
    fst.on('end', () => {
      rv();
    });

    fst.on('error', err => {
      c.status(500);
      rj();
    });

    fst.pipe(c.response);
  });
});

app.run(8008);