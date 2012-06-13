/**
 * BigEars finds all event listeners in a window (including nested frames/iframes). 
 * Built for WebKit.
 *
 * e.g.: to find all 'mouseover' and 'mouseout' listeners on a page
 * // do this as early as possible, before all other JavaScript inclusions.
 * var ears = new BigEars();
 *
 * // do this to retrieve the event list
 * var listeners = ears.findListeners([ "mouseover", "mouseout"]).listeners;
 *
 *
 * SEE https://github.com/DataTables/VisualEvent/blob/master/js/parsers/
 */
function BigEars(w) {
	if (w === undefined) w = window;
	
	this.mainWindow = w;
	this.level3Listeners = [];
	this.windows = [w];
	
	this.wrapLevel3ListenersGlobal(w);
};

BigEars.prototype.wrapLevel3ListenersGlobal = function(mainWindow) {
	var bigEars = this;
	
	// var realWindowConstructor = mainWindow.__proto__.constructor;
	// window.__proto__.constructor = function() {
		// var w = realWindowConstructor.apply(null, arguments);
		// bigEars.windows.push(w);
		// bigEars.warpLevel3ListenersForWindow(w);
		// return w;
	// };	
	bigEars.warpLevel3ListenersForWindow(mainWindow);
};

BigEars.prototype.warpLevel3ListenersForWindow = function(w) {
	for (var i=0, l=BigEars.elementClassNames.length; i<l; ++i) {
		var ec = w[BigEars.elementClassNames[i]];
		if (!ec) continue;
		ec.prototype.realAddEventListener = ec.prototype.addEventListener;
		//alert("> patching " + ec + " (" + ec.prototype.realAddEventListener + ")");
		ec.prototype.addEventListener = function(type, listener, useCapture) {
			// alert("<!>");
			bigEars.level3Listeners.push({
				'node'     : this,
				'eventName': type,
				'callback': listener,
				'source'   : "level3"
			});
			this.realAddEventListener(type, listener, useCapture);
		};
	}
};

BigEars.elementClassNames = [
	'HTMLAnchorElement',
	'HTMLAppletElement',
	// 'HTMLAudioElement', //html5
	'HTMLAreaElement',
	'HTMLBaseElement',
	'HTMLBaseFontElement',
	// 'HTMLBlockquoteElement', ??
	'HTMLBodyElement',
	'HTMLBRElement',
	'HTMLButtonElement',
	'HTMLDirectoryElement',
	'HTMLDivElement',
	'HTMLDListElement',
	'HTMLFieldSetElement',
	'HTMLFontElement',
	'HTMLFormElement',
	'HTMLFrameElement',
	'HTMLFrameSetElement',
	'HTMLHeadElement',
	'HTMLHeadingElement',
	'HTMLHRElement',
	'HTMLHtmlElement',
	'HTMLIFrameElement',
	'HTMLImageElement',
	'HTMLInputElement',
	// 'HTMLKeygenElement', //html5
	//'HTMLIsIndexElement', // alias for ??
	'HTMLLabelElement',
	// 'HTMLLayerElement',
	'HTMLLegendElement',
	'HTMLLIElement',
	'HTMLLinkElement',
	'HTMLMapElement',
	'HTMLMenuElement',
	'HTMLMetaElement',
	'HTMLModElement',
	'HTMLObjectElement',
	'HTMLOListElement',
	'HTMLOptGroupElement',
	'HTMLOptionElement',
	// 'HTMLOutputElement', //html5
	'HTMLParagraphElement',
	'HTMLParamElement',
	'HTMLPreElement',
	'HTMLQuoteElement',
	'HTMLScriptElement',
	'HTMLSelectElement',
	// 'HTMLSourceElement', //html5
	'HTMLStyleElement',
	'HTMLTableCaptionElement',
	'HTMLTableCellElement',
	// 'HTMLTableDataCellElement', ??
	// 'HTMLTableHeaderCellElement', ??
	'HTMLTableColElement',
	'HTMLTableElement',
	'HTMLTableRowElement',
	'HTMLTableSectionElement',
	'HTMLTextAreaElement',
	// 'HTMLTimeElement', //html5
	'HTMLTitleElement',
	// 'HTMLTrackElement', //html5
	'HTMLUListElement',
	// 'HTMLVideoElement' //html5
];

BigEars.prototype.getOffset = function(e) {
	var curLeft = curTop = undefined;
	if (e.offsetParent) {
		curLeft = curTop = 0;
		do {
			curLeft += e.offsetLeft;
			curTop += e.offsetTop;
		} while (e = e.offsetParent);
	} else {
		curLeft = e.offsetLeft;
		curTop = e.offsetTop;
	}
	return { 'top': curTop, 'left': curLeft };
};

BigEars.prototype.findListeners = function(eventNames) {
	return this.getListenerPositions(
		this.findListeners(eventNames).listeners
	);
};

BigEars.prototype.fireListeners = function(eventNames, reverse) {
	var i, il, listener, listenData = this.findListeners(eventNames);
	var report = { 'callbacks': 0, 'called': 0, 'errors': 0, 'windows': listenData.windows };
	
	if (reverse) { listenData.listeners.reverse(); }
	
	for (i=0, il=listenData.listeners.length; i<il; ++i) {
		listener = listenData.listeners[i];
		report.callbacks++;
		var cb = function() {
			try {
				report.called++;
				listener.callback.call(listener.node, {
					'target': listener.node,
					'currentTarget': listener.node,
					'cancelable': false,
					'bubbles': true,
					'defaultPrevented': false,
					'timeStamp': Date.now(),
					'type': 'click'
				});
			} catch(err) {
				report.errors++;
				alert("fire error: (" + listener.node.tagName + ":" + i + ") " + err);
			}
		};
		//setTimeout(cb, 1);
		cb();
	}
	
	return report;
};

/**
 * The returned list holds object with the following attributes:
 * - node     : the original DOM element to which the event listeners were attached;
 * - eventName: the names of the events that we are looking for;
 * - callbacks: a list of callbacks that are invoked for this event.
 */
BigEars.prototype.findListeners = function(eventNames, mainWindow) {
	if (mainWindow === undefined) mainWindow = this.mainWindow;
	var i, il, w, frames, windows = [ mainWindow ], listeners = [], exploredWindows = 0;
	
	while (windows.length > 0) {
		try {
			w = windows.shift();
			
			// extract windows from (i)frames
			frames = w.document.querySelectorAll('iframe, frame');
			for (i=0, il=frames.length; i<il; ++i) {
				// if the contentDocument is reachable, keep the window
				if (frames[i].contentDocument) windows.push(frames[i].contentWindow);
			}
		
			// find listeners for the current window
			listeners = listeners.concat(this.findSubmit(eventNames, w));
			listeners = listeners.concat(this.findLevel0Listeners(eventNames, w));
			listeners = listeners.concat(this.findLevel3Listeners(eventNames, w));
			listeners = listeners.concat(this.findJQueryListeners(eventNames, w));
			exploredWindows++;
			
		} catch(e) { alert('window listeners detection error : ' + e); }
	}
	
	return { 'listeners': listeners, 'windows': exploredWindows };
};

/**
 * The returned list holds object with the following attributes:
 * - tag : the listened DOM elements tag name
 * - type: the name of the event that is listened to;
 * - x   : the absolute X position of the listened DOM element
 * - y   : the absolute Y position of the listened DOM element
 * - w   : the width  of the listened DOM element
 * - h   : the height of the listened DOM element
 */
BigEars.prototype.getListenerPositions = function(listeners) {
	var listenerPositions = [], listener, offset, i, l;
	for (i=0, l=listeners.length; i<l; ++i) {
		listener = listeners[i];
		offset = this.getOffset(listener.node);
		listenerPositions.push({
			'type': listener.eventName,
			'tag' : listener.node.tagName,
			'x'   : offset.left,
			'y'   : offset.top,
			'w'   : listener.node.offsetWidth,
			'h'   : listener.node.offsetHeight,
			'src' : listener.source
		});
	}
	return listenerPositions;
};

// no eventNames => all listeners
BigEars.prototype.findLevel3Listeners = function(eventNames) {
	var results = [];
	if (!eventNames) return this.level3Listeners;
	for (var i=0, l=this.level3Listeners.length; i<l; ++i) {
		var listener = this.level3Listeners[i];
		if (eventNames.indexOf(listener.eventName) < 0) continue;
		results.push(listener);
	}
	return results;
};

// no eventNames => all listeners
BigEars.prototype.findJQueryListeners = function(eventNames, w) {
	var results = [], jq = w['jQuery']; 
	if (jq === undefined || !jq.data) return results;
	var nodes = jq('*');
	for (var i=0, l=nodes.length; i<l; ++i) {
		var node = nodes[i];
		var events = jq.data(node, 'events');
		if (!events) continue;
		for (var eventName in events) {
			if (!eventName) continue;
			if (eventNames && eventNames.indexOf(eventName) < 0) continue;
			var offset = this.getOffset(node);
			
			for (var cbIndex in events[eventName]) {
				results.push({
					'node'     : node,
					'eventName': eventName,
					'callback': events[eventName][cbIndex],
					'source'   : "jquery"
				});
			}
		}
	}
	return results;
};

// no eventNames => no listeners
BigEars.prototype.findLevel0Listeners = function(eventNames, w) {
	var results = [], eventName, callback, i, il, j, jl, elements, element;
	elements = w.document.querySelectorAll('*');
	
	for (j=0, jl=elements.length; j<jl; ++j) {
		element = elements[j];
		
		for (i=0, il=eventNames.length; i<il; ++i) {
			eventName = eventNames[i];
			callback = element['on' + eventName];
			if (!callback) continue;
			
			results.push({
				'node'     : element,
				'eventName': eventName,
				'callback': callback,
				'source'   : "level0"
			});
		}
	}
	return results;
};

// eventNames contains 'click' => listeners. Else, nothing.
BigEars.prototype.findSubmit = function(eventNames, w) {
	var results = [], i, l, e, cb;
	if (eventNames.indexOf('click') < 0) return results;
	
	var elements = w.document.querySelectorAll('form');
	for (i=0, l=elements.length; i<l; ++i) {
		e = elements[i];
		cb = function() { e.submit(); };
		results.push({
			'node'     : e,
			'eventName': 'click',
			'callback': cb,
			'source'   : "formSubmit"
		});
	}
	
	elements = w.document.querySelectorAll('input[type=submit]');
	for (i=0, l=elements.length; i<l; ++i) {
		e = elements[i];
		cb = function() { e.form.submit(); };
		results.push({
			'node'     : e,
			'eventName': 'click',
			'callback': cb,
			'source'   : "inputSubmit"
		});
	}
	
	return results;
};
