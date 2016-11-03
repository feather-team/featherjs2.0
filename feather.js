;var require, define;

(function(window, document, undefined){
var Helper = {
    is: function(o, type){
        return Object.prototype.toString.call(o) == '[object ' + type + ']';
    },

    makeArray: function(arr){
        return arr ? Helper.is(arr, 'Array') ? arr : [arr] : [];
    },

    each: function(o, callback){
        if(Helper.is(o, 'Array')){
            for(var i = 0; i < o.length; i++)
                callback(o[i], i);
        }else{
            for(var i in o)
                callback(o[i], i);
        }
    },

    inArray: function(arr, item){
        arr = Helper.makeArray(arr);

        if(!arr.length) return false;

        if(arr.indexOf){
            return arr.indexOf(item) > -1;
        }else{
            for(var i = 0; i < arr.length; i++){
                if(arr[i] == item) return true;
            }

            return false;
        }
    },

    log: function(){
        console && console.log.apply(console, arguments);
    },

    extend: function(sub, sup){
        Helper.each(sup, function(item, key){
            sub[key] = item;
        });

        return sub;
    }
};

function Module(name, callback, deps, isUse){
    var store = Module.stores[name] || {};

    if(store.exports){
        Helper.log('module ' + name + ' is exists!');
        return;
    }

    var self = Module.stores[name] = this;

    self.name = name;
    self.callback = callback;
    self.deps = Helper.makeArray(deps);
    self.needLoadDepsCount = self.deps.length;
    self.needNotices = Helper.makeArray(store.notices);
    self.exports = {};
    self.url = store.url;
    self.isUse = isUse;
    self.status = Module.STATUS.INITIALIZED;

    self.initialize();
}

Module.prototype = {
    initialize: function(){
        var self = this;

        if(self.deps.length){
            var needLoads = self.analyseNeedLoadDeps();

            if(needLoads.length){
                self.status = Module.STATUS.DEPSLOADING;
                Module.loadDeps(needLoads);
            }
        }else{
            self.complete();
        }
    },

    analyseNeedLoadDeps: function(){
        var self = this, needLoads = [];

        Helper.each(self.deps, function(name){
            var store = Module.stores[name];

            if(store){
                if(store.status > Module.STATUS.LOADED){
                    return store.notice(self);
                }else{
                    return store.notices.push(self);
                }
            }else{
                store = Module.stores[name] = {
                    name: name,
                    notices: [self],
                    status: Module.STATUS.UNDEFINED
                };

                needLoads.push(store);
            }
        });

        return needLoads;
    },

    receiveNotice: function(){
        !--this.needLoadDepsCount && this.complete();
    },

    notice: function(module){
        var self = this;

        //手动通知某个模块
        if(module){
            //如果该模块自己的依赖还没加载完，将需要通知的模块添加至通知队列
            if(self.status < Module.STATUS.COMPLETED){
                return self.needNotices.push(module);
            }

            //通知所依赖本模块的模块
            module.receiveNotice();
        }else{ 
            //通知所有模块
            Helper.each(self.needNotices, function(module){
                module.receiveNotice();
            });

            self.needNotices.length = 0;
        }
    },

    complete: function(){
        var self = this;

        self.status = Module.STATUS.COMPLETED;
        //如果是require.async 立即执行
        self.isUse && self.execute();
        self.notice();
    },

    execute: function(){
        var self = this;

        if(self.status != Module.STATUS.EXECUTED){
            self.status = Module.STATUS.EXECUTED;

            var callback = self.callback;

            if(Helper.is(callback, 'Function')){
                var exports;

                if(exports = self.callback.call(window, Module.require, self.exports, self)){
                    self.exports = exports;
                }
            }else if(Helper.is(callback, 'Object')){
                self.exports = callback;
            }
        }

        return self.exports;
    }
};

Helper.extend(Module, {
    STATUS: {
        UNDEFINED: 0,
        LOADING: 1,
        LOADED: 2,
        INITIALIZED: 3,
        DEPSLOADING: 4,
        COMPLETED: 5,
        EXECUTED: 6
    },

    stores: {},
    urlStores: {},

    getUrlStore: function(url){
        var urlStore = Module.urlStores[url];

        if(!urlStore){
            urlStore = Module.urlStores[url] = {
                modules: [],
                status: Module.STATUS.UNDEFINED,
                url: url
            };
        }

        return urlStore;
    }
});

Module.analyseNeedLoadUrls = function(deps){
    var needLoads = {};

    Helper.each(deps, function(store){
        var realUrl = require.url(store.name), urlStore = Module.getUrlStore(realUrl), urlStatus = urlStore.status;

        store.url = realUrl;

        if(urlStatus == Module.STATUS.LOADED){
            return Module.init(store.name);
        }

        urlStore.modules.push(store.name);

        if(!needLoads[realUrl] && urlStatus == Module.STATUS.UNDEFINED){
            needLoads[realUrl] = urlStore;
        }
    });

    return needLoads;
};

Module.loadDeps = function(deps){
    Helper.each(Module.analyseNeedLoadUrls(deps), function(urlStore){
        urlStore.status = Module.STATUS.LOADING;

        Module.load(urlStore.url, function(){
            urlStore.status = Module.STATUS.LOADED;

            Helper.each(urlStore.modules, function(module){
                Module.init(module);
            });
            
            urlStore.modules.length = 0;
        });
    });
};

Module.createElement = function(url){
    var isCss = /\.(?:css|less)(?:\?|$)/.test(url), type = isCss ? 'link' : 'script';
    
    var element = document.createElement(type);
    element.charset = Module.require.config('charset');

    //支持css加载
    if(isCss){
        element.rel = 'stylesheet';
        element.type = 'text/css';
        element.href = url;
    }else{
        element.type = 'text/javascript';
        element.src = url;
    }

    return element;
};

Module.load = function(url, callback){
    var element = Module.createElement(url);

    var  
    isLoaded = false,
    isCss = element.tagName.toLowerCase() == 'link',
    isOldWebKit = +navigator.userAgent.replace(/.*(?:Apple|Android)WebKit\/(\d+).*/, "$1") < 536,
    supportOnload = 'onload' in element;

    function onload(){
        //这边放置css中存在@import  import后会多次触发onload事件
        if(isLoaded) return;

        if(!element.readyState || /loaded|complete/.test(element.readyState)){
            element.onload = element.onerror = element.onreadystatechange = null;

            if(!isCss){
                element.parentNode.removeChild(element);
                element = null;
            }

            //已加载
            isLoaded = true;
            callback();
        }
    }

    element.onload = element.onerror = element.onreadystatechange = onload;
    document.getElementsByTagName('head')[0].appendChild(element);

    //有些老版本浏览器不支持对css的onload事件，需检查css的sheet属性是否存在，如果加载完后，此属性会出现
    if(isCss && (isOldWebKit || !supportOnload)){
        var id = setTimeout(function(){
            if(element.sheet){
                clearTimeout(id);
                return onload();
            }

            setTimeout(arguments.callee, 50);
        }, 50);
    }
};

//尝试初始化
Module.init = function(name){
    Module.stores[name].status < Module.STATUS.INITIALIZED && new Module(name);
};

require = Module.require = function(name){
    var realname = require.id(name);
    var store = Module.stores[realname];

    if(!store){
        throw new Error('module [' + realname + ']\' not found!');
    }

    return store.execute();
};

var rid = 0, config = {
    domain: '',
    baseurl: '',
    rules: [],
    charset: 'utf-8',
    map: {}
};

Helper.extend(require, {
    helper: Helper,

    version: '2.0.1',

    load: Module.load,

    config: function(name, value){
        if(Helper.is(name, 'Object')){
            Helper.each(name, function(v, k){
                require.config(k, v);
            });
        }else if(value !== undefined){
            if(name == 'map'){
                Helper.each(value, function(mods, url){
                    var map = config.map[url] || [];
                    
                    Helper.each(Helper.makeArray(mods), function(mod){
                        map.push(require.id(mod));
                    });

                    config.map[url] = map;
                });
            }else if(Helper.is(config[name], 'Object')){
                config[name] = Helper.extend(config[name] || {}, value);
            }else{
                config[name] = value;
            }
        }else{
            return config[name];
        }
    },

    async: function(deps, callback){
        deps = require.id(deps);

        new Module('_r_' + rid++, function(){   
            var modules = [];

            Helper.each(Helper.makeArray(deps), function(dep){
                modules.push(require(dep));
            });

            Helper.is(callback, 'Function') && callback.apply(window, modules);
        }, deps, true);
    },

    id: function(name){
        if(Helper.is(name, 'Array')){
            Helper.each(name, function(v, k){
                name[k] = require.id(v);
            });

            return name;
        }else{
            if(/:\/\//.test(name)) return name;

            var baseurl = config.baseurl || '';

            Helper.each(config.rules || [], function(item){
                name = name.replace(item[0], item[1]);
            }); 

            if(baseurl && name.charAt(0) != '/') name = baseurl.replace(/\/+$/, '') + '/' + name;

            return name.replace(/\/+/g, '/');
        }
    },

    url: function(name){
        var map = config.map || {}, domain = config.domain || '';

        for(var i in map){
            if(map.hasOwnProperty(i) && Helper.inArray(map[i], name)){
                name = i; break;
            }
        }
        
        return !/^(?:https?\:)?\/\//.test(name) ? domain + name : name;
    }
});

define = function(name, callback, deps){
    if(Helper.is(deps, 'Function')){
        var s = callback;
        callback = deps;
        deps = s;
    }

    deps = require.id(deps);
    name = require.id(name);

    new Module(name, callback, deps);
};

define.Module = Module;
})(window, document);