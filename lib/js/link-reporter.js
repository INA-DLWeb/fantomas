
phantom.injectJs("phantom.js");

/**
 * Link reporter
 */
function LinkReporter(client) 
{
	if (!(this instanceof arguments.callee)) return new LinkReporter(client);
	this.client = client; 
	this.urlRE = /^https?:\/\/.+/i;
	
	var links_cache = undefined;
	var reported_links = [];
	
	var resources_cache = undefined;
	var reported_resources = [];
	
	var frames_cache = undefined;
	var reported_frames = [];
	
	this.collectAndReport = function(forceAll) {
		this.collectLinksAndFrames(true);
		this.reportFrames(forceAll);
		this.reportLinks(forceAll);
		
		// report resources after frames so that things that are resources AND frames get reported as frames
		this.collectResources();
		this.reportResources(forceAll);
	};
	
	this.reportLinks = function(forceAll) {
		var u = this.getLinks();
		for (var i=0, l=u.length; i<l; ++i) {
			// don't report links twice (unless forced to)
			if (reported_links[u[i]] && !forceAll) continue;
			
			// remember reported links (to avoid reporting twice)
			reported_links[u[i]] = true;
			
			print({ 'type' : 'link', 'url' : u[i] });
		}
	};

	this.reportFrames = function(forceAll) {
		var f = this.getFrames();
		for (var i=0, l=f.length; i<l; ++i) {
			// don't report frames/iframes twice (unless forced to)
			if (reported_frames[f[i]] && !forceAll) continue;
			
			// remember reported frames/iframes (to avoid reporting twice)
			reported_frames[f[i]] = true;
			
			print({ 'type' : 'frame', 'url' : f[i] });
		}
	};
	
	this.reportResources = function(forceAll) {
		var r = this.getResources();
		for (var i=0, l=r.length; i<l; ++i) {
			// don't report frames that need to be explorer as resources
			if (reported_frames[r[i].url]) continue;
			
			// don't report resources twice (unless forced to)
			if (reported_resources[r[i].url] && !forceAll) continue;
			
			// remember reported resources (to avoid reporting twice)
			reported_resources[r[i].url] = true;
			
			print({ 'type' : 'resource', 'document' : r[i].document, 'url' : r[i].url });
		}
	};
	
	this.collectLinksAndFrames = function(append) {
		if (append === undefined) { append = true; }
		if (links_cache === undefined) { links_cache = []; }
		if (frames_cache === undefined) { frames_cache = []; }
		
		var r = this._extractLinksAndFrames();
		if (append) {
			links_cache = links_cache.concat(r.links);
			frames_cache = frames_cache.concat(r.frames);
		} else {
			links_cache = r.links;
			frames_cache = r.frames;
		}
		
		links_cache = this._removeDuplicates(links_cache);
		frames_cache = this._removeDuplicates(frames_cache);
	};
	
	this.collectResources = function() {
		resources_cache = [];
		var keys = Object.keys(this.client.resources);
		for (var i=0, l=keys.length; i<l; ++i) {
			var r = this.client.resources[keys[i]];
			if (!r.url.match(this.urlRE) || !r.status) continue;
			resources_cache.push({ 'document' : r.isDoc, 'url' : r.url });
		}
	};
	
	this._removeDuplicates = function(array) {
		var hash = {}, result = [], value, i, l;
		for (i=0, l=array.length; i<l; ++i) {
			value = array[i];
			if (hash[value]) continue;
			hash[value] = true;
			result.push(value);
		}
		return result;
	};
	
	this.getFrames = function() {
		if (frames_cache === undefined) {
			this.collectLinksAndFrames();
		}
		return frames_cache;
	};
	
	this.getLinks = function() {
		if (links_cache === undefined) {
			this.collectLinksAndFrames();
		}
		return links_cache;
	};
	
	this.getResources = function() {
		if (resources_cache === undefined) {
			this.collectResources();
		}
		return resources_cache;
	};
	
	this._extractLinksAndFrames = function() {
		var links = [], filteredLinks = [], 
				frames = [], filteredFrames = [], 
				i, l, 
				extracted = this._extractLinkAndFrames();
		
		// filter out bad link urls
		links = links.concat(extracted.urls);
		links = links.concat(this.client.navigable);
		for (i=0, l=links.length; i<l; ++i) {
			if (!links[i].match(this.urlRE)) continue;
			filteredLinks.push(links[i]);
		}
		
		// filter out bad frame urls
		frames = extracted.unreachableFrames;
		for (i=0, l=frames.length; i<l; ++i) {
			if (!frames[i].match(this.urlRE)) continue;
			filteredFrames.push(frames[i]);
		}
		
		return { 'links' : filteredLinks, 'frames' : filteredFrames };
	};
	
	// return the list of URLs found in link tags (<a>)
	this._extractLinkAndFrames = function() {
		// extract HREF and ONCLICK attributes on links
		
		var report = this.client.page.evaluate(function() {
			var i, il, j, jl, result = { 
				'url' : [],               // A.href=http: + AREA.href=http;
				'js' : [],                // A.href=JavaScript: + AREA.href
				'missed' : 0,             // parse failures
				'unreachableFrames' : [], // unreachable frames to be explored individually
				'dlinks': []              // document.links
			};
		
			// 0: find page size
			var pageArea = document.body.scrollWidth * document.body.scrollHeight;
			
			// 1: find all (I)FRAMES and keep those that are reachable, report unreachables
			var documents = [document], frames = document.querySelectorAll('iframe, frame'), frame;
			for (i=0, il=frames.length; i<il; ++i) {
				frame = frames[i];
				//if ((frame.scrollWidth*frame.scrollHeight/pageArea) >= 0.7) {
					if (!frame.contentDocument) {
						// cannot access frame/iframe DOM
						result.unreachableFrames.push(frame.src);
					} else {
						documents.push(frame.contentDocument);
					}
				//}
			}
			
			// 2: extract links for all documents
			var d, links, forms, attr, miss, dl;
			for (i=0, il=documents.length; i<il; ++i) {
				d = documents[i];
			
				// get DOM links list (document.links)
				dl = d.links;
				for (j=0, jl=dl.length; j<jl; ++j) {
					result.dlinks.push(dl[j].href);
				}
				
				// extracts links "manually"
				links = d.querySelectorAll('a, area');
				for (j=0, jl=links.length; j<jl; ++j) {
					if (links[j] === null) continue;
					miss = true;
					
					if ((attr = links[j]['href']) && (typeof attr === 'string') && !attr.match(/^\s*$/)) {
					
						var jsMatcher = /^\s*javascript\:(.*)$/ig, match;
						if ((match = jsMatcher.exec(attr)) !== null && (match.length > 1)) {
							// href="javascript:"
							result.js.push(match[1]);
							miss = false;
						} else {
							// href="http:"
							result.url.push(attr);
							miss = false;
						}
					}

					if (miss) {
						// 'a/area' where nothing could be extracted
						result.missed++;
					}
				}
				
				// extract FORM action urls
				forms = d.querySelectorAll('form');
				for (j=0, jl=forms.length; j<jl; ++j) {
					if (!forms[j]) continue;
					if ((attr = forms[j]['action']) && (typeof attr === 'string') && !attr.match(/^\s*$/)) {
						result.url.push(attr);
					}
				}
			}
			
			// 3: return extacted links (+ unreachable frames src)
			return result;
		});
		
		if (!report) {
			debug("ERROR: Could not extract links from page");
			report = { 'url' : [], 'js' : [], 'missed' : 0, 'unreachableFrames' : [], 'dlinks': [] };
		}
		
		// extract URLs from collected attributes
		var urls = [];
		urls = urls.concat(report.url);
		urls = urls.concat(report.dlinks);
		for (var i=0, l=report.js.length; i<l; ++i) {
			urls = urls.concat(this.parseJsLinks(report.js[i]));
		}
		
		debug(
			"LINKS_PARSE: href:" + report.url.length + 
			" js:" + report.js.length + 
			" miss:" + report.missed + 
			" FOUND:" + urls.length
		);
		return { 'urls' : urls, 'unreachableFrames' : report.unreachableFrames };
	};
	
	this.parseJsLinks = function(js) {
		var urls = [];
		if (js === undefined || js === null) return urls;
		
		var urlMatcher0 = /\s(http[s]?:[^\s>]+)(?:\s|\/?>)/igm;
		var urlMatcher1 = /"(https?:[^">]+)"/igm;
		var urlMatcher2 = /'(https?:[^'>]+)'/igm;
		var urlMatcher3 = /(?:href|src)\s*=\s*(https?:[^\s>]+)[\s|>]/igm;
		var urlMatcher4 = /(?:href\s*=\s*["']?([^\s>\n\r]+)["']?[\s|>]|(http[^\s>\n\r]+))/igm;
		var urlMatcher5 = /(?:href\s*=\s*["']?([^\s>\n\r]+)["']?[\s|>]|(http[^\s>\n\r]+))/igm;
		
		var match = null;
		while ((match = urlMatcher0.exec(js)) !== null && match[1] !== undefined) { urls.push(match[1]); }
		while ((match = urlMatcher1.exec(js)) !== null && match[1] !== undefined) { urls.push(match[1]); }
		while ((match = urlMatcher2.exec(js)) !== null && match[1] !== undefined) { urls.push(match[1]); }
		while ((match = urlMatcher3.exec(js)) !== null && match[1] !== undefined) { urls.push(match[1]); }
		while ((match = urlMatcher4.exec(js)) !== null && match[1] !== undefined) { urls.push(match[1]); }
		while ((match = urlMatcher5.exec(js)) !== null && match[1] !== undefined) { urls.push(match[1]); }

		return urls;
	};
	
}
