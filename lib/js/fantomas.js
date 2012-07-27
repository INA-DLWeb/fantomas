
phantom.injectJs("phantom.js");
	
function Fantomas(params) {
	// read params
	for (var key in this.params) {
		if (params[key] !== undefined) { 
			this.params[key] = params[key]; 
		}
		debug("PARAM: " + key + "=" + JSON.stringify(this.params[key]));
	}
	// create submodules
	this.client = new Client(
		this.params.totalTimeout, 
		this.params.loadFinishedTreshold, 
		this.params.firstActivityTimeout,
		this.params.firstFinishTimeout
	);
	
	// create a pattern for a 10000s (~2h45m) window around now
	var t = Math.floor(Date.now() / 1000);
	var t0 = "" + (t - 10000), tn = "" + (t + 10000), i
	for (i=0; t0[i] == tn[i]; i++);
	var pattern = t0.substring(0, i) + "\\d{" + (10 - i) + "," + (13 - i) + "}"; // ([^\\d])";
	
	var h = this.params.urlHitLimit;
	this.client.page.urlHitLimit = {
		"limit": (h === undefined ? -1 : h),
		"pattern": pattern,
		"replace": "[TIMESTAMP]"
	};
	debug("normalizer: " + JSON.stringify(this.client.page.urlHitLimit));
	// phantom.exit();
	
	this.interactor = new Interactor(this.client.page);
	this.reporter = new LinkReporter(this.client);
};

Fantomas.prototype = {

	// default values
	params: {
		// additional request http headers
		'headers': {},
		// number of hardware clicks
		'clicks': 1000,
		'loadFinishedTreshold': 2,
		// after main pageLoad
		'totalTimeout': 90,
		'firstActivityTimeout': 10, 
		'firstFinishTimeout': 120,
		 // after user interactions
		'uxFirstActivityTimeout': 3,
		'uxFirstFinishTimeout': 5,
		'urlHitLimit': 1,
	},
	
	// private attributes
	client: null,
	interactor: null,
	reporter: null,
	
	// page load
	open: function(url, openCallback) {
		var fantomas = this;
		var cb = function(result) {
			openCallback.call(fantomas, result.status, result.duration, result.info); 
		};
		this.client.open(url, cb, this.params.headers);
	},
	
	// initialize tools		
	reportCount: 0,
	reportLinks: function() {
		debug(" -+- collecting links (" + (this.reportCount++) + ")");
		this.reporter.collectAndReport();
	},
	
	savePNG: function(prefix) {
		debug(" -+- rendering screenshot");
		var s = (prefix === undefined) ? '' : prefix;
		var filename = s + this.client.getFinalUrl().replace(/[^\w]/g, '_') + '.png';
		this.client.page.render(filename);
		print({ 'type' : 'screenshot', 'file' : filename });
	},
	
	waitAndDo: function(after) {
		this.client.waitForResources(
			this.params.loadFinishedTreshold*1000, 
			after, 
			this.params.uxFirstActivityTimeout*1000, 
			this.params.uxFirstFinishTimeout*1000, 
			true
		); 
	},
	
	// random clicks for 'duration' seconds
	randomClicks: function(onDone, duration) {
		debug(" -+- simulating random 'clicks' for " + duration + " seconds");
		var rc = this.interactor.clicks(6, true, duration*1000);
		debug(" -+- clicks simulated : " + JSON.stringify(rc));
		this.waitAndDo(onDone);
	},
	
	smartClicks: function(onDone) {
		var fantomas = this;
		debug(" -+- simulating UX interactions");
		
		debug(" -+- simulating interactions (smart)");
		var rc = fantomas.interactor.fireUXListeners(fantomas.client, false);
		fantomas.waitAndDo(function() {
			debug(" -+- clicks simulated (smart) : " + JSON.stringify(rc));
			fantomas.reportLinks();
			
			debug(" -+- simulating interactions (hardware)");
			rc = fantomas.interactor.randomClicks(fantomas.params.clicks);
			fantomas.waitAndDo(function() {
				debug(" -+- clicks simulated (hardware) : " + JSON.stringify(rc));
				fantomas.reportLinks();
				
				onDone();
			});
		});
	},
	
	mouseOverAll: function(onDone) {
		var fantomas = this;
		debug(" -+- sending 'mouseover' events");
		this.interactor.sendMouseOver(function() {
			debug(" -+- waiting for missing ressources (after mouseOver)");
			fantomas.waitAndDo(onDone); 
		}, '*', 0);
	},
	
	navigationLocked: function(locked) {
		this.client.page.navigationLocked = locked;
	},
	
	exitDone: function() {
		exit("done", { 
			'links': this.reporter.getLinks().length,
			'resources': this.reporter.getResources().length,
			'frames': this.reporter.getFrames().length
		});
	}
};
