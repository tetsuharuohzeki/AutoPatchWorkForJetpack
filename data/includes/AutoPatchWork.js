var sendRequest = this.chrome ? function(data,callback){
	if (callback) {
		chrome.extension.sendRequest(data,callback);
	} else {
		chrome.extension.sendRequest(data);
	}
} : (function(){
	var eventData = {};
	safari.self.addEventListener('message',function(evt){
		(evt.name in eventData) && eventData[evt.name](evt.message);
	},false);
	return function(data, callback, name){
		name = (name || '') + (Date.now() + Math.random().toString(36));
		callback && (eventData[name] = callback);
		safari.self.tab.dispatchMessage(name,data);
	}
})();
(function(g){
	if(window.name === 'AutoPatchWork-request-frame') return;
	var options = {
		BASE_REMAIN_HEIGHT:400,
		FORCE_TARGET_WINDOW:true,
		DEFAULT_STATE:true,
		TARGET_WINDOW_NAME:'_blank',
		css:''
	};
	var status = {
		state:true,
		loaded:false,
		page_number:1,
		nextLink:null,
		pageElement:null,
		last_element:null,
		insert_point:null,
		append_point:null,
		bottom:null,
		remain_height:null
	};
	var Root = /BackCompat/.test(document.compatMode) ? document.body : document.documentElement;
	var debug = false;
	var isXHTML = document.documentElement.nodeName !== 'HTML'
		&& document.createElement('p').nodeName !== document.createElement('P').nodeName;
	window.addEventListener('AutoPatchWork.siteinfo', siteinfo, false);
	var bar;
	sendRequest({url:location.href,isFrame:top!=self},init,'AutoPatchWork.init');
	function init(info){
		if (info.config) {
			options.BASE_REMAIN_HEIGHT = info.config.remain_height;
			options.DEFAULT_STATE = info.config.auto_start;
			options.FORCE_TARGET_WINDOW = info.config.target_blank;
			options.css = info.css;
			debug = info.config.debug_mode;
		}
		var fails = [];
		var r = info.siteinfo.some(function(s){
			return AutoPatchWork(s) || (fails.push(s),false);
		});
		if (r === false){
			sendRequest({failed_siteinfo:fails});
		}
	}
	function siteinfo(evt){
		if (evt.siteinfo && !window.AutoPatchWork) {
			AutoPatchWork(evt.siteinfo);
		} else if (evt.siteinfo){
			var ev = document.createEvent('Event');
			ev.initEvent('AutoPatchWork.reset', true, true);
			for (var k in evt.siteinfo){
				ev[k] = evt.siteinfo[k];
			}
			document.dispatchEvent(ev);
		}
	}
	function AutoPatchWork(siteinfo){
		if (window.AutoPatchWork) return true;
		if (isXHTML){
			status.resolver = function(){
				return document.documentElement.namespaceURI;
			};
			get_next = x_get_next;
			get_next_elements = x_get_next_elements;
			createHTML = createXHTML;
			siteinfo.nextLink = addDefaultPrefix(siteinfo.nextLink);
			siteinfo.pageElement = addDefaultPrefix(siteinfo.pageElement);
		}

		var loading = false;
		var nextLink     = status.nextLink     = siteinfo.nextLink;
		var pageElement = status.pageElement = siteinfo.pageElement;

		var next = get_next(document);
		if (!next){
			return message('nextLink not found.');
		}
		if ( (next.host && next.host !==location.host) || (next.protocol && next.protocol !==location.protocol) ){
			request = request_iframe;
		}
		if ('www.tumblr.com' === location.host) {
			script_filter = none_filter;
		} else if (location.host==='matome.naver.jp'){
			var _get_next = get_next;
			get_next = function(doc){
				var next = _get_next(doc);
				if (!next || !next.hasAttribute('onclick')) return;
				var nextpage = next.getAttribute('onclick').match(/goPage\(\s*(\d+)\s*\)/)[1];
				var form=document.getElementsByName('missionViewForm')[0];
				var param=[].slice.call(form).map(function(i){return i.name+'='+(i.name==='page'?nextpage:i.value);}).join('&');
				next.href = location.pathname+'?'+param;
				return next;
			};
			next = get_next(document);
		}

		var page_elements = get_next_elements(document);
		if (!page_elements.length)
			return message('pageElement not found.');

		var last_element = status.last_element = page_elements.pop();
		var insert_point = status.insert_point = last_element.nextSibling;
		var append_point = status.append_point = last_element.parentNode;
		var htmlDoc, url;

		var loaded_urls = {};
		var page_num = 0;
		loaded_urls[location.href] = true;
		loaded_urls[next.href] = true;
		status.remain_height || (status.remain_height = calc_remain_height());
		window.addEventListener('scroll', check_scroll, false);
		window.addEventListener('AutoPatchWork.request', request, false);
		window.addEventListener('AutoPatchWork.load', load, false);
		window.addEventListener('AutoPatchWork.append', append, false);
		window.addEventListener('AutoPatchWork.error', error_event, false);
		window.addEventListener('AutoPatchWork.reset', reset, false);
		window.addEventListener('AutoPatchWork.state', state, false);
		window.addEventListener('AutoPatchWork.terminated', terminated, false);
		window.addEventListener('AutoPatchWork.toggle', toggle, false);
		if (options.FORCE_TARGET_WINDOW){
			window.addEventListener('AutoPatchWork.DOMNodeInserted', target_rewrite, false);
		} else {
			window.addEventListener('AutoPatchWork.DOMNodeInserted', pushState, false);
		}
		if (debug) {
			var bottom = status.bottom = document.createElement('div');
			var line = document.createElement('div');
			bottom.setAttribute('style','position:absolute;width:0px;left:0px;top:0px;');
			line.setAttribute('style','position:absolute;height:10px;background-color:rgba(0,0,0,0.1);left:0px;');
			bottom.style.height = Root.scrollHeight + 'px';
			line.style.width = Root.scrollWidth + 'px';
			line.style.bottom = status.remain_height + 'px';
			bottom.appendChild(line);
			document.body.appendChild(bottom);
		}
		bar  = document.createElement('div');
		bar.id = 'AutoPatchWork-Bar';
		bar.className = 'on';
		bar.onmouseover = function(){
			var onoff = document.createElement('button');
			onoff.textContent = 'on/off';
			onoff.onclick = toggle;
			var option = document.createElement('button');
			option.textContent = 'options';
			option.onclick = function(){
				sendRequest({options:true});
			};
			var maneger = document.createElement('button');
			maneger.textContent = 'siteinfo';
			maneger.onclick = function(){
				sendRequest({manage:true});
			};
			bar.appendChild(onoff);
			bar.appendChild(option);
			bar.appendChild(maneger);
			bar.onmouseover = null;
		};
		function toggle(){
			if (bar.className === 'on'){
				bar.className = 'off';
				state_off();
			} else if(bar.className === 'off') {
				bar.className = 'on';
				state_on();
			}
		}
		document.body.appendChild(bar);
		bar.addEventListener('click', function(e){if(e.target === bar)toggle();},false);
		var style = document.createElement('style');
		style.textContent = options.css;
		style.id = 'AutoPatchWork-style';
		document.head.appendChild(style);
		var pageHeight = Root.offsetHeight;
		if (window.innerHeight >= pageHeight) {
			check_scroll();
		}
		dispatch_event('AutoPatchWork.initialized',status);
		if (!options.DEFAULT_STATE){
			state_off();
		}
		sendRequest({message:'AutoPatchWork.initialized', siteinfo:siteinfo});
		dispatch_event('AutoPatchWork.request');
		window.AutoPatchWork = AutoPatchWork;

		return true;

		function reset(evt){
			for (var k in status){
				if (!evt[k]) {
					status[k] = evt[k];
				}
			}
			window.removeEventListener('scroll', check_scroll, false);
			window.removeEventListener('AutoPatchWork.request', request, false);
			window.removeEventListener('AutoPatchWork.load', load, false);
			window.removeEventListener('AutoPatchWork.append', append, false);
			window.removeEventListener('AutoPatchWork.error', error_event, false);
			window.removeEventListener('AutoPatchWork.reset', reset, false);
			window.removeEventListener('AutoPatchWork.DOMNodeInserted', target_rewrite, false);
			window.removeEventListener('AutoPatchWork.DOMNodeInserted', pushState, false);
			window.removeEventListener('AutoPatchWork.state', state, false);
			if (status.bottom && status.bottom.parentNode) {
				status.bottom.parentNode.removeChild(status.bottom);
			}
			delete window.AutoPatchWork;
			AutoPatchWork({nextLink:status.nextLink,pageElement:status.pageElement});
		}
		function error_event(evt){
			error(evt.message);
		}
		function state(evt){
			if (evt.status === 'on') {
				state_on();
			} else if (evt.status === 'off') {
				state_off();
			}
		}
		function toggle(){
			if (status.state) {
				state_off();
			} else {
				state_on();
			}
		}
		function terminated(evt){
			status.state = false;
			window.removeEventListener('scroll', check_scroll, false);
			bar.className = 'terminated';
			setTimeout(function(){
				bar && bar.parentNode && bar.parentNode.removeChild(bar);
			},1000);
			if (status.bottom && status.bottom.parentNode) {
				status.bottom.parentNode.removeChild(status.bottom);
			}
		}
		function message(message){
			if (debug && window.console) console.log(message, JSON.stringify(siteinfo,null,2));
			return false;
		}
		function error(message){
			if (debug && window.console) console.log(message, JSON.stringify(siteinfo,null,2));
			status.state = false;
			window.removeEventListener('scroll', check_scroll, false);
			if (status.bottom && status.bottom.parentNode) {
				status.bottom.parentNode.removeChild(status.bottom);
			}
			bar.className = 'error';
			return false;
		}
		function dispatch_event(type,opt){
			var ev = document.createEvent('Event');
			ev.initEvent(type, true, false);
			if (opt) {
				Object.keys(opt).forEach(function(k){
					if (!ev[k]) {
						ev[k] = opt[k];
					}
				});
			}
			document.dispatchEvent(ev);
		}
		function dispatch_mutation_event(opt){
			var ev = document.createEvent('MutationEvent');
			with (opt) {
				ev.initMutationEvent(opt.type, canBubble, cancelable, relatedNode, prevValue, newValue, attrName, attrChange);
				targetNode.dispatchEvent(ev);
			}
		}
		function check_scroll(){
			if (loading) return;
			var remain = Root.scrollHeight - window.innerHeight - window.pageYOffset;
			if (status.state && remain < status.remain_height) {
				dispatch_event('AutoPatchWork.append');
			}
		}
		function target_rewrite(evt){
			if (evt && evt.target){
				var as = evt.target.getElementsByTagName('a');
				for (var i = 0, l = as.length;i < l;i++){
					var a = as[i], _a = a.getAttribute('href');
					if (_a && !/^javascript:/.test(_a) && !/^#/.test(_a) && !a.target){
						a.setAttribute('target',options.TARGET_WINDOW_NAME);
					}
				}
			}
		}
		function pushState(evt){
			if (evt && evt.target){
				var as = evt.target.getElementsByTagName('a');
				var url = evt.newValue;
				for (var i = 0, l = as.length;i < l;i++){
					var a = as[i], _a = a.getAttribute('href');
					if (_a && !/^javascript:/.test(_a) && !/^#/.test(_a))
						a.addEventListener('click',function(e){
							//document.body.scrollTop = 0;
							history.pushState('', '', url);
						},false);
				}
			}
		}
		function state_on(){
			status.state = true;
			bar.className = 'on';
		}
		function state_off(){
			status.state = false;
			bar.className = 'off';
		}
		function request(){
			if(!loading){
				loading = true;
			}
			var url = next.href || next.getAttribute('href') || next.action || next.value;
			var x = new XMLHttpRequest();
			x.onload = function() {
				dispatch_event('AutoPatchWork.load',{response:x, url:url});
			};
			x.onerror = function(){
				dispatch_event('AutoPatchWork.error',{message:'request failed. status:' + x.status});
			};
			x.open('GET', url, true);
			x.overrideMimeType('text/html; charset=' + document.characterSet);
			x.send(null);
		}
		function request_iframe(){
			if(!loading){
				loading = true;
			}
			var loaded = false;
			var url = next.href || next.getAttribute('href') || next.action || next.value;
			var iframe = document.createElement('iframe');
			iframe.style.display = 'none';
			iframe.name = 'AutoPatchWork-request-frame';
			iframe.onload = function(){
				var doc = iframe.contentDocument;
				!loaded && dispatch_event('AutoPatchWork.load',{htmlDoc:doc, url:url});
				iframe.parentNode && iframe.parentNode.removeChild(iframe);
			};
			iframe.onerror = function(){
				dispatch_event('AutoPatchWork.error',{message:'request failed. status:' + x.status});
			};
			iframe.src = url;
			document.body.appendChild(iframe);
			iframe.contentDocument.addEventListener('DOMContentLoaded',function(){
				var doc = iframe.contentDocument;
				dispatch_event('AutoPatchWork.load',{htmlDoc:doc, url:url});
				loaded = true;
			},false);
		}
		function script_filter(text){
			return text.replace(/<script(?:[ \t\r\n][^>]*)?>[\S\s]*?<\/script[ \t\r\n]*>/gi, ' ');
		}
		function none_filter(text){
			return text;
		}
		function load(evt){
			loading = false;
			if (!evt.response && !evt.htmlDoc) {
				return;
			}
			loaded_url = evt.url;
			if (evt.response) {
				htmlDoc = createHTML(script_filter(evt.response.responseText));
			} else if (evt.htmlDoc) {
				htmlDoc = evt.htmlDoc;
			} else {
				return;
			}
			status.loaded = true;
			check_scroll();
		}
		function append(evt){
			if (!status.loaded || !htmlDoc){
				bar.className = 'loading';
				return;
			}
			status.loaded = false;
			var root,node;
			if (/^tbody$/i.test(status.append_point.localName)) {
				var colNodes = document.evaluate('child::tr[1]/child::*[self::td or self::th]',
					status.append_point, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
				var colums = 0;
				for (var i = 0, l = colNodes.snapshotLength;i<l;i++) {
					var col = colNodes.snapshotItem(i).getAttribute('colspan');
					colums += parseInt(col,10) || 1;
				}
				node = document.createElement('td');
				root = document.createElement('tr');
				node.setAttribute('colspan',colums);
				root.appendChild(node);
			} else {
				root = node = document.createElement('div');
			}
			node.className = 'autopagerize_page_separator_blocks';
			var hr = node.appendChild(document.createElement('hr'));
			hr.className = 'autopagerize_page_separator';
			var p = node.appendChild(document.createElement('p'));
			p.className = 'autopagerize_page_info';
			var a = p.appendChild(document.createElement('a'));
			a.className = 'autopagerize_link';
			a.href = loaded_url;
			a.setAttribute('number',++status.page_number);
			status.append_point.insertBefore(root, status.insert_point);
			var docs = get_next_elements(htmlDoc);
			docs.forEach(function(doc,i,docs){
				var insert_node = status.append_point.insertBefore(document.importNode(doc, true), status.insert_point);
				var mutation = {
					targetNode:insert_node,
					type:'AutoPatchWork.DOMNodeInserted',
					canBubble:true,
					cancelable:false,
					relatedNode:status.append_point,
					prevValue:null,
					newValue:loaded_url,
					attrName:null,
					attrChange:null
				};
				dispatch_mutation_event(mutation);
				docs[i] = insert_node;
			});
			if (status.bottom) status.bottom.style.height = Root.scrollHeight + 'px';
			next = get_next(htmlDoc);
			if (!next) {
				dispatch_event('AutoPatchWork.terminated',{message:'nextLink not found.'});
			} else {
				next_href = next.getAttribute('href') || next.getAttribute('action') || next.getAttribute('value');
				if (next_href && !loaded_urls[next_href]) {
					loaded_urls[next_href] = true;
				} else {
					return dispatch_event('AutoPatchWork.error',{message:next_href + ' is already loaded.'});
				}
				bar.className = status.state ? 'on' : 'off';
				setTimeout(function(){
					dispatch_event('AutoPatchWork.request');
				}, 1000);
			}
			dispatch_event('AutoPatchWork.pageloaded');
			htmlDoc = null;
		}
		function createXHTML(str){
			return new DOMParser().parseFromString(str, 'application/xhtml+xml');
		}
		function createHTML(source){
			// http://gist.github.com/198443
			var doc = document.implementation.createHTMLDocument ?
				document.implementation.createHTMLDocument('HTMLParser') :
				document.implementation.createDocument(null, 'html', null);
			var range = document.createRange();
			range.selectNodeContents(document.documentElement);
			var fragment = range.createContextualFragment(source);
			var headChildNames = {title: true, meta: true, link: true, script: true, style: true, /*object: true,*/ base: true/*, isindex: true,*/};
			var child,
			head = doc.querySelector('head') || doc.createElement('head'),
			body = doc.querySelector('body') || doc.createElement('body');
			while ((child = fragment.firstChild)) {
				if (
					(child.nodeType === Node.ELEMENT_NODE && !(child.nodeName.toLowerCase() in headChildNames)) || 
					(child.nodeType === Node.TEXT_NODE &&/\S/.test(child.nodeValue))
				   )
					break;
				head.appendChild(child);
			}
			body.appendChild(fragment);
			doc.documentElement.appendChild(head);
			doc.documentElement.appendChild(body);
			return doc;
		}
		function get_next(doc){
			return doc.evaluate(status.nextLink,doc,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
		}
		function get_next_elements(doc){
			var r = doc.evaluate(status.pageElement, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			for (var i = 0,l = r.snapshotLength, res = new Array(l);i<l;i++) res[i] = r.snapshotItem(i);
			return res;
		}
		function x_get_next(doc){
			return doc.evaluate(status.nextLink,doc,status.resolver,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
		}
		function x_get_next_elements(doc){
			var r = doc.evaluate(status.pageElement, doc, status.resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			for (var i = 0,l = r.snapshotLength, res = (l && new Array(l)) || [];i<l;i++) res[i] = r.snapshotItem(i);
			return res;
		}
		function calc_remain_height(){
			var bottom;
			var _point = insert_point;
			while (_point && !_point.getBoundingClientRect) {
				_point = _point.nextSibling;
			}
			if (_point) {
				var rect = _point.getBoundingClientRect();
				bottom = rect.top + window.pageYOffset;
			} else if (append_point && append_point.getBoundingClientRect) {
				var rect = append_point.getBoundingClientRect();
				bottom = rect.top + rect.height + window.pageYOffset;
			}
			if (!bottom) {
				bottom = Math.round(Root.scrollHeight * 0.8);
			}
			return Root.scrollHeight - bottom + options.BASE_REMAIN_HEIGHT;
		}
		function addDefaultPrefix(xpath, prefix) {
			var tokenPattern = /([A-Za-z_\u00c0-\ufffd][\w\-.\u00b7-\ufffd]*|\*)\s*(::?|\()?|(".*?"|'.*?'|\d+(?:\.\d*)?|\.(?:\.|\d+)?|[\)\]])|(\/\/?|!=|[<>]=?|[\(\[|,=+-])|([@$])/g;
			var TERM = 1, OPERATOR = 2, MODIFIER = 3;
			var tokenType = OPERATOR;
			prefix += ':';
			function replacer(token, identifier, suffix, term, operator, modifier) {
				if (suffix) {
					tokenType =
						(suffix == ':' || (suffix == '::' && (identifier == 'attribute' || identifier == 'namespace')))
						? MODIFIER : OPERATOR;
				} else if (identifier) {
					if (tokenType == OPERATOR && identifier != '*') {
						token = prefix + token;
					}
					tokenType = (tokenType == TERM) ? OPERATOR : TERM;
				} else {
					tokenType = term ? TERM : operator ? OPERATOR : MODIFIER;
				}
				return token;
			}
			return xpath.replace(tokenPattern, replacer);
		}
	}
})(this);
