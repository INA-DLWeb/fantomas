/**
 * FANTOMAS
 * A headless, Webkit-powered, Javascript-enabled, Flash-enabled Web Scrapper.
 * based on PhantomJS (http://www.phantomjs.org/)
 *
 * Flash support: http://developer.qt.nokia.com/doc/qt-4.8/qtwebkit.html#netscape-plugin-support 
 * 
 * MMNMMMMMMMMMMMNNMMMNNNyyddddhhyyysyydNMMMMMMMMMMMMMMMMMMMNmN
 * MNNNMMMMMMNNyNNmNMNhysyyyhhyssso+///::+yNNNNNNNMNNMNNNNNNdyN
 * NNNNNNMMMMNNmNmdmy+ooosoosso+++/:--.....-sNNNNNNNNNNNmmNmmmN
 * MNNNNNMMMNNmsmmh/++++++++++///::-.....````:mNNNNNNNNmddmmhom
 * MMMNNNMMMNNNdNd//++++//////:::::--..```````:NNNNNmmmmddmmdhN
 * MMMNNNMNNNNdsN+/++++///:////::::--.-..````` sNNNmmddddhdmdsm
 * MMMMMMMNNNNmyd/+++++///////:::::-:--..``````:NNNmmmmmddmNdyN
 * MMMMMMMMNNNmhs++++++///////:::::::---..`````.NmmmmmmmmmNNdsN
 * MMMMMMMMMNNo+++o+ooooossosoo/:/--/+//::-..```hNNNmmNNNNNmdom
 * MMMMMMMMNNN+/+++oyyhhyydddmy+/:..hmdhhsso/.``-+ymNNNNNNNNmhm
 * MMMMMMMMNNNh/++++osyo/yyoyhs+/:..dMooh+:o/.```..yNMNNNNNNdsm
 * NNdNMmdNNdmN+++++++++++oso////:``.o/++/-.```..-:mdmNddNNhdmd
 * NNhmMmhNNddMs+oo+++//::///////:.``--....`......sNhdNddNNydNh
 * MMMMMMMMNNNms+oo+ooo++++++oo+++:--.::::::--...-NNNNNNNMMNdyN
 * MMMMMMMMMMMNmsooooooooo+++sooydoyh/os+///:-..`yMNNMMMMMNNmdN
 * MMMMMMMMMMMdyNyoooooooo+++++oshs/:--/oo+//--+yNNNNMMNNNNNhyN
 * MMMMMMMMMMMNNMNyoooooossssssysssoo+///+//:-hNMNNNNMMMNMNNddN
 * MMMMMMMMMMMmsMMNysoo+o+oosssssso+//+o/::::hMMMNMMNMMMMMNNdyN
 * MMMMMMMMMNNmmMMMNssooo+ooosssssso/:---:::dMMMMNMMMMMMMMMNddN
 * MMMMMMMMNNNdhMMMMysyssoo+++o++//::--://:-NMMMMMMMMMMMMMMNdmN
 * MMMMMMMNNNNNyNMMNNhsyhhhsssyyyysoooo++::ymMMMMMMMMMMMMMMMyhM
 * MMMMMMMMMMMMNMMMMMMNdhydmNNNNNNNmho/++sdhhMMMMMMMMMMMMMMMNNM
 *
 */

(function() {
	phantom.injectJs("phantom.js");
	phantom.injectJs("resource.js");
	phantom.injectJs("throttler.js");
	phantom.injectJs("interactor.js");
	phantom.injectJs("client.js");
	phantom.injectJs("link-reporter.js");
	phantom.injectJs("fantomas.js");
	
	debug("PATH: " + phantom.libraryPath);
	debug("VERSION: " + JSON.stringify(phantom.version));
	
	if (phantom.args.length < 1) {
		exit("usage: phantomjs " + phantom.scriptName + " url [sessionId] [crawlLevel] [clicks]");
		return;
	}
	var url = phantom.args[0];
	var sessionId = phantom.args.length > 1 ? phantom.args[1] : undefined;
	var crawlLevel = phantom.args.length > 2 ? phantom.args[2] : undefined;
	var clicks = phantom.args.length > 3 ? phantom.args[3] : undefined;
	
	var headers = {};
	if (sessionId !== null) { headers["X-Crawl-Session"] = sessionId; }
	if (crawlLevel !== null) { headers["X-Site-Level"] = crawlLevel; }
	
	var f = new Fantomas({
		'headers' : headers,
		'clicks' : clicks,
		'totalTimeout': 3*60, 
		'loadFinishedTreshold': 2, 
		'firstActivityTimeout': 10, 
		'firstFinishTimeout': 2*60,
		'uxFirstActivityTimeout': 3, 
		'uxFirstFinishTimeout': 5,
		'urlHitLimit': 1,
	});
	
	f.open(url, function(status, duration, info) {
		var fantomas = this;
	
		debug("LOADED duration: " + duration + "ms (" + fantomas.client.getResourcesCount() + " resources)");
		var info = JSON.stringify(info).replace(/"/g, "'");
		
		// exit if error or timeout
		if (status === 'success') {
			debug("SUCCES");
		} else if (status === 'timeout') {
			exit(
				"TIMEOUT" +
				" status=" + status + 
				" info=" + info + 
				" load_diagnostic=" + fantomas.client.getLoadDiagnostic()
			);
			return;
		} else {
			exit(
				"FAILURE" +
				" status=" + status + 
				" info=" + info + 
				" load_diagnostic=" + fantomas.client.getLoadDiagnostic()
			);
			return;
		};
		
		// block nav
		fantomas.navigationLocked(true);
		
		// adapt browser to full page size
		fantomas.client.adaptViewport();
		
		// simulate interaction and extract links 
		fantomas.reportLinks();
		
		// lock date
		// fantomas.client.lockDate(true);
		
		// start simulating UX
		fantomas.mouseOverAll(function() {
			afterClicks = function() {	
				fantomas.reportLinks();
				//fantomas.savePNG(Date.now() + '_');
				fantomas.exitDone(); 
			}
				
			fantomas.reportLinks();
				
			if (fantomas.params.clicks < 0) { 
				fantomas.randomClicks(afterClicks, 10);
			} else { 
				fantomas.smartClicks(afterClicks); 
			}
		});	
	});
}());
