var localStorage = require("simple-storage").storage;
var self = require("self");
var requests = require("request");
var pageMod = require("page-mod");

Object.keys || (Object.keys = function(k){
	var r = [];
	for (var i in k) r.push(i);
	return r;
});

var Storage = {
	get_data:function(key){
		var val = localStorage.getItem(key);
		if (val) {
			return JSON.parse(val);
		}
		return null;
	},
	get:function(key){
		var data = Storage.get_data(key);
		if (data.expire) {
			var expire = new Date(data.expire);
			if (expire.getTime() > new Date().getTime()) {
				return data.value;
			} else {
				localStorage.removeItem(key);
			}
		} else if (data.hasOwnProperty('value')) {
			return data.value;
		} else {
			return data;
		}
		return null;
	},
	has:function(key){
		if (localStorage[key] === void 0) {
			return false;
		}
		var data = Storage.get_data(key);
		if (data.expire) {
			var expire = new Date(data.expire);
			if (expire.getTime() > new Date().getTime()) {
				return true;
			} else {
				localStorage.removeItem(key);
			}
		} else {
			return true;
		}
		return false;
	},
	set:function(key, value, expire){
		var data = {value:value};
		if (expire) {
			if (expire instanceof Date) {
				data.expire = expire.toString();
			} else {
				if (typeof expire === 'object') {
					expire = Storage.duration(expire);
				}
				var time = new Date();
				time.setTime(time.getTime() + expire);
				data.expire = time.toString();
			}
		}
		localStorage.setItem(key, JSON.stringify(data));
	},
	// http://gist.github.com/46403
	duration: function duration (dat) {
		var ret = 0, map = {
			sec:1, min:60, hour:3600, day:86400, week:604800,
			month:2592000, year:31536000
		};
		Object.keys(dat).forEach(function(k){if(map[k] > 0)ret += dat[k] * map[k];});
		return ret * 1000;
	}
};
var version = '', Manifest, IconData = {};


var g = this;
var siteinfo = [], timestamp, manifest, site_stats = {}, site_fail_stats = {}, custom_info = {};
var MICROFORMATs = [
	{
		url          : '^https?://.',
		nextLink     : '//a[@rel="next"] | //link[@rel="next"]',
		insertBefore : '//*[contains(concat(" ",@class," "), " autopagerize_insert_before ")]',
		pageElement  : '//*[contains(concat(" ",@class," "), " autopagerize_page_element ")]'
	}
	,{
		url          : '^https?://.',
		nextLink     : '//link[@rel="next"] | //a[contains(concat(" ",@rel," "), " next ")] | //a[contains(concat(" ",@class," "), " next ")]',
		pageElement  : '//*[contains(concat(" ",@class," "), " hfeed ") or contains(concat(" ",@class," "), " xfolkentry ")]'
	}
];
var AutoPatchWork = {
	state:true,
	css:'',
	barcss:'',
	config:{
		auto_start:true,
		target_blank:true,
		remain_height:400,
		disable_iframe:false,
		debug_mode:false,
		bar_status:'on'
	},
	save_css:function(css){
		AutoPatchWork.css = localStorage.AutoPatchWorkCSS = css;
	},
	update:function(){
		localStorage.AutoPatchWorkConfig = JSON.stringify(AutoPatchWork.config);
	},
	disable_sites:[],
	site_check:function(url){
		if (url.indexOf('http') !== 0) return true;
		return AutoPatchWork.disable_sites.some(function(site){
			if (site.type === 'regexp') {
				return new RegExp(site.matcher).test(url);
			} else if (site.type === 'prefix') {
				return url.indexOf(site.matcher) === 0;
			} else if (site.type === 'domain') {
				return new RegExp('^https?://' + site.matcher + '/').test(url);
			}
		});
	},
	add_disable_site:function(site){
		AutoPatchWork.disable_sites.push(site);
		localStorage.disable_sites = JSON.stringify(AutoPatchWork.disable_sites);
	},
	save_disable_site:function(){
		localStorage.disable_sites = JSON.stringify(AutoPatchWork.disable_sites);
	},
	delete_disable_site:function(site){
		var site_s = JSON.stringify(site);
		for (var i = 0;i < AutoPatchWork.disable_sites.length; i++){
			var str = JSON.stringify(AutoPatchWork.disable_sites[i]);
			if (str === site_s){
				AutoPatchWork.disable_sites.splice(i, 1);
				localStorage.disable_sites = JSON.stringify(AutoPatchWork.disable_sites);
				break;
			}
		}
	}
};
if(g.safari){
	safari.extension.settings.addEventListener('change',function(evt){
		if(evt.key in AutoPatchWork.config){
			AutoPatchWork.config[evt.key] = evt.newValue;
		} else if(evt.key === 'excludes'){
			var urls = evt.newValue.trim().split(' ');
			AutoPatchWork.disable_sites = urls.map(function(url){
				return {type:'prefix',matcher:url};
			});
			AutoPatchWork.save_disable_site();
		}
	},false);
}
exports.main = function (aOptions, aCallbacks) {
	if (localStorage.disable_sites) {
		AutoPatchWork.disable_sites = JSON.parse(localStorage.disable_sites);
	} else {
		localStorage.disable_sites = JSON.stringify(AutoPatchWork.disable_sites);
	}
	if (localStorage.AutoPatchWorkConfig) {
		AutoPatchWork.config = JSON.parse(localStorage.AutoPatchWorkConfig);
	} else {
		localStorage.AutoPatchWorkConfig = JSON.stringify(AutoPatchWork.config);
	}
	if (localStorage.site_stats) {
		site_stats = JSON.parse(localStorage.site_stats);
	} else {
		localStorage.site_stats = JSON.stringify(site_stats);
	}
	if (localStorage.site_fail_stats) {
		site_fail_stats = JSON.parse(localStorage.site_fail_stats);
	} else {
		localStorage.site_fail_stats = JSON.stringify(site_fail_stats);
	}
	if (localStorage.custom_info) {
		custom_info = JSON.parse(localStorage.custom_info);
	} else {
		localStorage.custom_info = JSON.stringify(custom_info);
	}
	if (localStorage.AutoPatchWorkCSS) {
		AutoPatchWork.css = localStorage.AutoPatchWorkCSS;
	} else {
		init_css();
	}
	init_barcss();

	var version = '', Manifest;
	IconData = {};

	get_manifest(function(_manifest){
		Manifest = _manifest;
		version = _manifest.version;
	});

	if (Storage.has('siteinfo_wedata')){
		var data = Storage.get('siteinfo_wedata');
		siteinfo = data.siteinfo;
		timestamp = new Date(data.timestamp);
		applyCustom();
	} else {
		UpdateSiteinfo();
	}
};

function handleMessage(request, sender, sendResponse){
	if (request.message === 'AutoPatchWork.initialized'){
		var id = request.siteinfo['wedata.net.id'] || 'microformats';
		site_stats[id] = ++site_stats[id] || 1;
		localStorage.site_stats = JSON.stringify(site_stats);
		return;
	}
	if (request.failed_siteinfo){
		request.failed_siteinfo.forEach(function(s){
			var id = s['wedata.net.id'];
			if (!id){
				return;
			}
			site_fail_stats[id] = ++site_fail_stats[id] || 1;
		});
		localStorage.site_fail_stats = JSON.stringify(site_fail_stats);
		return;
	}
	if (request.manage) {
		openOrFocusTab('siteinfo_manager.html');
		return;
	}
	if (request.options) {
		openOrFocusTab('options.html');
		return;
	}
	if (!AutoPatchWork.state) return;
	if (request.isFrame && AutoPatchWork.config.disable_iframe) {
		return;
	}
	var infos = [], url = request.url;
	if (!url || AutoPatchWork.site_check(url)) return;
	if (url.index) return;
	for (var i = 0,len = siteinfo.length, s;i < len;i++){
		s = siteinfo[i];
		if (!s.disabled  && new RegExp(siteinfo[i].url).test(url)){
			infos.push(siteinfo[i]);
		}
	}
	sendResponse({siteinfo:infos,config:AutoPatchWork.config,css:AutoPatchWork.css+AutoPatchWork.barcss});
}
function openOrFocusTab(uri){
/*
	if(g.chrome) {
		chrome.windows.getAll({populate:true},function(windows){
			if (!windows.some(function(w){
				if(w.type === 'normal'){
					return w.tabs.some(function(t){
						if(t.url === H + uri){
							chrome.tabs.update(t.id, {'selected':true});
							return true;
						}
					});
				}
			})) {
				chrome.tabs.getSelected(null, function(t){
					chrome.tabs.create({'url':uri, 'selected':true, index:t.index+1});
				});
			}
		});
	} else if (g.safari) {
		if(!safari.application.browserWindows.some(function(w){
			return w.tabs.some(function(t){
				if(t.url.indexOf(H + uri) === 0){
					t.activate();
					return true;
				}
			});
		})) {
			safari.application.activeBrowserWindow.openTab().url = H + uri;
		}
	} else if(g.opera) {
		opera.extension.tabs.create({url:uri});
	}
*/
}
function getWedataId(inf){
	return parseInt(inf.resource_url.replace('http://wedata.net/items/',''),10);
}
function applyCustom(info){
	siteinfo.forEach(function(i){
		var id = i['wedata.net.id'];
		var ci = custom_info[id];
		if (ci){
			Object.keys(ci).forEach(function(k){
				i[k] = ci[k];
			});
		}
	});
}
function Siteinfo(info){
	var keys = ['nextLink','pageElement','url','insertBefore'];
	siteinfo = [];
	info.forEach(function(i){
		var d = i.data, r = {};
		keys.forEach(function(k){
			if (d[k]) r[k] = d[k];
		});
		try {
			new RegExp(r.url);
		} catch(e) {
			return;
		}
		r['wedata.net.id'] = getWedataId(i);
		siteinfo.push(r);
	});
	siteinfo.sort(function(a, b) { return (b.url.length - a.url.length);});
	siteinfo.push.apply(siteinfo,MICROFORMATs);
	siteinfo.push({
		"url":          "^http://matome\\.naver\\.jp/",
		"nextLink":    "id(\"_pageNavigation\")//a[contains(@class, \"mdPagination01Next\")]",
		"pageElement": "//div[contains(@class, \"blMain00Body\")]/*",
		//exampleUrl:  'http://matome.naver.jp/odai/2124461146762161898',
		"wedata.net.id": "matome.naver"
	});
	siteinfo.push({
		url:          '^http://www\\.google\\.(?:[^.]+\\.)?[^./]+/images\\?.'
		,nextLink:    'id("nav")//td[@class="cur"]/following-sibling::td/a'
		,pageElement: '//table[tbody/tr/td/a[contains(@href, "/imgres")]]'
		//,exampleUrl:  'http://images.google.com/images?gbv=2&hl=ja&q=%E3%83%9A%E3%83%BC%E3%82%B8'
	});
	timestamp = new Date;
	Storage.set('siteinfo_wedata', {siteinfo:siteinfo,timestamp:timestamp.toLocaleString()}, {day:1});
	applyCustom();
}
function get_manifest(callback){
	var url = 'manifest.json';
	var text = self.data.load(url);
	callback(JSON.parse(text));
}
function init_css(){
	var text = self.data.load(url);
	AutoPatchWork.save_css(text);
}
function init_barcss(){
	var text = self.data.load(url);
	AutoPatchWork.barcss = text;
}
function UpdateSiteinfo(callback,error_back){
	var request = requests.Request({
		url: "http://ss-o.net/json/wedataAutoPagerize.json",
		onComplete: function (aResponse) {
			var results = aResponse.json;
			var info;
			try {
				info = results;
				Siteinfo(info);
				if (typeof callback === 'function'){
					callback();
				}
			} catch (e) {
				if (typeof error_back === 'function'){
					error_back();
				}
				return;
			}
		}
	});
	request.get();
}
