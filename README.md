feather.js 2. 0
=============

简介
------------

feather.js 2.0 是1.x基础上的重构，并去除了deps配置。

[feather.js 1.x 传送门](http://github.com/feather-team/featherjs)

API
------------

* ** define(mod, [deps, ]factory)**：定义一个模块, define依赖某一模块时 需要提供deps参数, deps参数可为数组或者字符串。

```js
define('mod/mod1/mod1.js', function(require, exports, module){
    module.exports = {
        name: 'mod1',
        desc: 'this is mod1'
    };
});
```

* **require(modname)**: 获取某一个已存在模块，并将该模块return的值或者module.exports的值返回给变量。该函数调用的模块，必须为一个已经加载完毕的模块。

```js
define('mod/mod1/mod1.js', 'mod/jquery/jquery.js', function(require, exports, module){
    var jquery = require('mod/jquery/jquery.js');
    
    module.exports = {
        name: 'mod1',
        desc: 'this is mod1',
        $: jquery
    };
});
```

* **require.async(modname[, callback])**: 异步调用模块， 多个modname则使用数组表示，callback为记载完所有的模块后执行的回调函数，所有被调用的模块的返回值都会被当成callback的参数传入
```js
require.async('mod/mod1/mod1.js', function(Mod1){
    console.log(Mod1);
});
```

```js
require.async(['mod/mod1/mod1.js', 'mod/mod2/mod2.js'], function(Mod1, Mod2){
    console.log(Mod1, Mod2);
});
```

* **require.config**: 配置全局。
```js
//baseurl配置，所有不以/开头的模块名会自动加上该参数得到完整的模块名。
require.config.baseurl = '';

//解析模块名
require.config.rules = [
    [/^\w+$/, '$&/$&.js'],   //定义了一个规则，所以为或调用了字母和数组合的模块名时，比如 abc,则都会解析成abc/abc.js
    [/^common~\w+$/, 'common/plugins/$&.js'] //common~a => common/plugins/a.js
];

//通过rules配置会自动调用mod/mod1/mod1.js模块，解析过程为 baseurl + rules = 模块名; 
//注: 这一解析过程包含define和require以及require.async过程。
require.async('mod1'); 


//配置domain参数，所有的请求发出时会自动带上domain参数，并发出请求，
//注：该参数不参与模块名的解析。
require.config.domain = 'http://github.com/';

//map表，用于将模块合并打包，表示包于各模块的对应关系，并当require某一个模块时，会自动发送请求至map的key值url上。 //该参数不参与模块名的解析。
require.config.map = {
    'pkg/mod.js': ['mod/mod1/mod1.js', 'mod/jquery/jquery.js']
};