/**
  titbit-loader Copyright (C) 2019.08 BraveWang
  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 3 of the License , or
  (at your option) any later version.
 */

'use strict';

const fs = require('fs');

/**
 * 路由映射方式：
 *  文件名就是路由，支持目录作为分组或者说是模块的名称，目录中的子目录则不会再加载。
 *  这样如果目录api中存在文件content.js，则路由为/api/content。
 * RESTFul模式：
 *  如果要使用RESTFul模式，则文件中必须存在以下一些方法：
 *    get
 *    list
 *    create
 *    update
 *    delete
 *  对应的路由就是：
 *    GET   /api/content/id
 *    GET   /api/content（不带id表示获取列表）
 *    POST  /api/content
 *    UPDATE  /api/content/id
 *    DELETE  /api/content/id
 * 一个控制器可以是一个function或 => 函数，也可以是一个class形式的闭包。
 * 总之，一个路由对应一个控制器，就是回调函数，而class需要实例化。
 * 因为class本质上也是function，并且即使function声明的函数，也是有可能需要实例化的，
 * 并且有可能会有使用prototype，而不是class，所以需要在类中声明类型，如果文件中仅仅是
 * 一个需要引入的函数文件，则只需要在文件最开头加上_
 * 规则：
 *  mode='callback' 需要实例化，并且实例化以后默认使用callback作为回调函数，
 *  mode='restful' RESTFul模式，这种情况，实例化以后使用RESTFul模式对应的方法加载。
 * 
 * 不导出模块或类： 
 *  如果不想导出目录或者某一个文件，则需要在文件名称开头加上!。
 * 
 * 路由分组名称：
 *  默认情况，如果是在目录中的文件，则表示全部属于按照目录名称作为分组，
 *  而如果在类中提供了groupName属性，则使用groupName的值。
 * 
 * 路由命名：
 *  默认情况，路由的名称是[目录-文件-方法名称]。
 */

/**
 * 关于模型：model有时候并不是必须的，可能只是想做一些前端应用，
 * 或者通过其他机制，也可能是每个人使用model的习惯不太一样，
 * 无论如何，loader提供了是否加载model的选项，并且
 * 
 */

class loader {

  constructor (options = {}) {
    //let appDir = __dirname + '.';
    let appDir = '.';
    
    this.globalMidTable = {};
    this.groupMidTable = {};
    this.fileMidTable = {};

    if (typeof options !== 'object') {
      options = {};
    }
    
    if (options.appPath !== undefined) {
      appDir = options.appPath;
    }

    appDir = fs.realpathSync(appDir);
    this.config = {
      //当作为模块引入时，根据路径关系，
      //可能的位置是node_modules/titbit-loader/loader.js，
      //所以默认在父级目录两层和node_modules同级。
      appPath     : appDir,
      controllerPath  : appDir+'/controller',
      modelPath     : appDir+'/model',
      midwarePath   : appDir+'/middleware',
      loadModel     : true,
      midwareDesc   : appDir+'midware.js',

      deep : 1,
      mname : 'model',
      grpre : '', //分组前缀
    };

    this.mdb = null; //在加载Model时可能需要传递参数

    this.cargs = null; //如果你要在初始化controller时传递参数可以设置此变量，但是目前这个功能还没有开启。

    for (var k in options) {
      if (k == 'appPath') { continue; }
      if (k == 'loadModel') {
        this.config.loadModel = options.loadModel;
        continue;
      } else if (k === 'mname') {
        this.config.mname = options.mname;
        continue;
      } else if (k === 'pre') {
        this.config.grpre = options.pre;
        continue;
      }

      switch (k) {
        case 'controllerPath':
        case 'modelPath':
        case 'midwarePath':
          this.config[k] = `${this.appPath}/${options[k]}`; break;
        default:;
      }
    }

    try {
      fs.accessSync(this.config.controllerPath, fs.constants.F_OK);
    } catch (err) {
      if (this.config.controllerPath.length > 0) {
        fs.mkdirSync(this.config.controllerPath);
      }
    }

    try {
      fs.accessSync(this.config.midwarePath, fs.constants.F_OK);
    } catch (err) {
      if (this.config.midwarePath.length > 0) {
        fs.mkdirSync(this.config.midwarePath);
      }
    }

    try {
      fs.accessSync(this.config.modelPath, fs.constants.F_OK);
    } catch (err) {
      if (this.config.modelPath.length > 0) {
        fs.mkdirSync(this.config.modelPath);
      }
    }

    if (options.mdb !== undefined && this.config.loadModel) {
      this.mdb = options.mdb;
    }
    
  }

  init (app) {
    this.loadController(app);
    this.loadMidware(app);
    if (this.config.loadModel) {
      this.loadModel(app);
    }
  }

  loadController (app) {
    var cfiles = {};
    this.readControllers(this.config.controllerPath, cfiles);
    let cob = null;
    for (let k in cfiles) {
      try {
        cob = require(k);
        cob = new cob();
        this.setRouter(app, cob, cfiles[k]);
        cob = null;
      } catch (err) {
        console.error(err.message, k);
      }
    }

    return cfiles;
  }

  setRouter (app, cob, cf) {
    if (cob.mode === undefined || cob.mode !== 'callback') {
      cob.mode = 'restful';
    }
    var group = this.config.grpre + cf.dirgroup;
    var npre = cf.filegroup;
    let routeParam = '/:id';
    if (cob.param !== undefined
      && cob.param !== null
      && typeof cob.param === 'string')
    {
      routeParam = cob.param;
      if (routeParam[0]!== '/') {
        routeParam = `/${routeParam}`;
      }
    }

    if (cob.mode === 'restful') {
      
      if (cob.post !== undefined && typeof cob.post === 'function') {
        app.router.post(`${cf.filegroup}`, cob.post.bind(cob),{
          name: cob.name_create || `${npre}/post`,
          group: group
        });
      }
      if (cob.delete !== undefined && typeof cob.delete === 'function') {
        app.router.delete(`${cf.filegroup}${routeParam}`, cob.delete.bind(cob),{
          name: cob.name_delete || `${npre}/delete`,
          group: group
        });
      }
      if (cob.put !== undefined && typeof cob.put === 'function') {
        app.router.put(`${cf.filegroup}${routeParam}`, cob.put.bind(cob),{
          name: cob.name_update || `${npre}/put`,
          group: group
        });
      }
      if (cob.get !== undefined && typeof cob.get === 'function') {
        app.router.get(`${cf.filegroup}${routeParam}`, cob.get.bind(cob),{
          name: cob.name_get || `${npre}/get`,
          group: group
        });
      }
      if (cob.list !== undefined && typeof cob.list === 'function') {
        app.router.get(`${cf.filegroup}`, cob.list.bind(cob),{
          name: cob.name_list || `${npre}/list`,
          group: group
        });
      }
      if (cob.patch !== undefined && typeof cob.patch === 'function') {
        app.router.patch(`${cf.filegroup}`, cob.patch.bind(cob),{
          name: cob.name_list || `${npre}/patch`,
          group: group
        });
      }
      if (cob.options !== undefined && typeof cob.options === 'function') {
        app.router.options(`${cf.filegroup}${routeParam}`, cob.options.bind(cob),{
          name: cob.name_list || `${npre}/options`,
          group: group
        });
      }
    } else {
      if (cob.method === undefined) {
        cob.method = 'GET';
      }
      let cname = `${npre}`;
      switch (cob.method) {
        case 'GET':
        case 'POST':
        case 'DELETE':
        case 'PUT':
        case 'OPTIONS':
        case 'PATCH':
        case 'HEAD':
        case 'TRACE':
          app.router[ cob.method.toLowerCase() ](
            cf.filegroup,
            cob.callback.bind(cob), {
              name: cname,
              group: group
            });
          break;
        default:;
      }
      if (cob.router !== undefined && typeof cob.router === 'object') {
        for (let k in cob.router) {
          if (cob[k] !== undefined && typeof cob[k] === 'function') {
            if (app.router.methods.indexOf(cob.router[k].toUpperCase()) >= 0)
            {
              app.router[cob.router[k].toLowerCase()](cf.filegroup+'/'+k, cob[k]);
            }
          }
        }
      }
    }

    if (cob.__mid && typeof cob.__mid === 'function') {
      var mid = cob.__mid();
      if (mid) {
        this.fileMidTable[cf.filegroup] = {
          group:group,
          mid:mid
        };
      }
    }
  }

  /**
   * 加载中间件，仅仅是通过一个js文件，
   * 中间件不宜过度使用，否则容易混乱。
   */
  loadMidware (app) {
    for (let i=0; i<this.globalMidTable.length; i++) {
      this.loadGlobalMidware(app, this.globalMidTable[i]);
    }
    //加载组，此时组已经确定
    for (var k in this.groupMidTable) {
      for (let i=0; i<this.groupMidTable[k].length; i++) {
        this.loadGroupMidware(app, this.groupMidTable[k][i], k);
      }
    }

    for(var k in this.fileMidTable) {
      for (let i=0; i<this.fileMidTable[k].mid.length; i++) {
        this.loadFileMidware(app, 
          this.fileMidTable[k].mid[i], k, 
          this.fileMidTable[k].group
        );
      }
    }

  }

  getMidwareInstance(m) {
    var mt = null;
    let tmp = null;
    if (m.name[0] == '@') {
      tmp = require(this.config.midwarePath+'/'+m.name.substring(1));
      if (m.args === undefined) {
        mt = new tmp();
      } else {
        mt = new tmp(m.args);
      }
      //bind this
      return mt.middleware.bind(mt);
    } else {
      mt = require(this.config.midwarePath+'/'+m.name);
    }
    return mt;
  }

  loadGlobalMidware (app, m) {
    if (!m.name || m.name == '') {
      return;
    }
    
    let opts = {};
    if (m.method !== undefined) {
      opts.method = m.method;
    }

    var makeOpts = (groupname) => {
      let op = {};
      if (m.method !== undefined) {
        op.method = m.method;
      }
      op.group = this.config.grpre + groupname;
      return op;
    };

    if (m.group !== undefined) {
      if (m.group instanceof Array) {
        for (let i=0; i<m.group.length; i++) {
          app.use(this.getMidwareInstance(m), makeOpts(m.group[i]));
        }
        return ;
      }
      opts.group = this.config.grpre + m.group;
    }
    app.use(this.getMidwareInstance(m), opts);
  }

  loadGroupMidware(app, m, group) {
    if (!m.name || m.name == '') {
      return;
    }
    var opts = {
      group: this.config.grpre + group,
    };
    if (m.method !== undefined) {
      opts.method = m.method;
    }
    app.use(this.getMidwareInstance(m), opts);
  }

  loadFileMidware (app, m, f, group) {
    var opts = {
      group: this.config.grpre + group,
      name:[],
    };

    if (m.path === undefined) {
      opts.name = [`${f}/create`, `${f}/update`,
        `${f}/delete`,`${f}/get`,`${f}/list`,`${f}/callback`
      ];
    } else {
      if (typeof m.path === 'string') {
        m.path = [ m.path ];
      }
      for(let i=0; i<m.path.length; i++) {
        opts.name.push(`${f}/${m.path[i]}`);
      }
      
    }
    app.use(this.getMidwareInstance(m), opts);
  }

  /**
   * 加载数据库操作接口，一个表要对应一个js文件，
   * 默认没有模型关联的支持，这需要自己编写SQL语句。
   */
  loadModel (app) {
    if (app.service[this.config.mname] === undefined) {
      app.service[this.config.mname] = {};
    }
    try {
      var mlist = fs.readdirSync(this.config.modelPath, {withFileTypes:true});
      for (let i=0; i < mlist.length; i++) {
        if (!mlist[i].isFile()) { continue; }
        if (mlist[i].name.substring(mlist[i].name.length-3) !== '.js') {
          continue;
        }
        this.requireModel(app, mlist[i].name);
      }
    } catch (err) {
      console.error(err);
    }
  }

  requireModel(app, mfile) {
    try {
      let m = require(this.config.modelPath+'/'+mfile);
      let mname = mfile.substring(0, mfile.length-3);
      app.service[this.config.mname][mname] = new m(this.mdb);
    } catch (err) {
      console.error(err.message, ' -- ', mfile);
    }
  }

  stripExtName (filename) {
    let sf = filename.split('.js');
    return `${sf[0]}`;
  }

  /**
   * 读取控制器目录中的文件
   * @param {string} cdir 
   * @param {object} cfiles 
   * @param {number} deep 
   * @param {string} dirgroup 
   */
  readControllers (cdir, cfiles, deep = 0, dirgroup = '') {
    let files = fs.readdirSync(cdir, {withFileTypes:true});
    let tmp = '';
    for (let i=0; i<files.length; i++) {
      if (files[i].isDirectory() && deep < 1) {
        if (files[i].name[0] == '!') { continue; }
        this.readControllers(cdir+'/'+files[i].name, 
          cfiles, deep+1,
          `${dirgroup}/${files[i].name}`
        );
      } else if (files[i].isFile()) {
        if (files[i].name.length < 4) { continue; }
        if (files[i].name.indexOf('.js') !== files[i].name.length - 3) {
          continue;
        }
        if (files[i].name == '__mid.js') {
          if (deep == 0) {
            this.globalMidTable = require(cdir+'/'+files[i].name);
          } else {
            this.groupMidTable[dirgroup] = require(cdir+'/'+files[i].name);
          }
          continue;
        }

        tmp = this.stripExtName(files[i].name);
        cfiles[cdir+'/'+files[i].name] = {
          filegroup: dirgroup + '/' + tmp,
          dirgroup: dirgroup || '/',
          name: files[i].name,
          modname: tmp
        };
      }
    }
    
  }

}

module.exports = loader;
