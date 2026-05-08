// OSINT Command Center – App
// All tool data + UI logic

const TOOLS = [
  // ── Flight Tracking ──
  { cat: "Flight Tracking", icon: "✈️", name: "ADS-B Exchange", url: "https://globe.adsbexchange.com/", desc: "Unfiltered flight tracking with military & government aircraft. No data censorship.", tags: ["live","free"], live: true },
  { cat: "Flight Tracking", icon: "✈️", name: "FlightRadar24", url: "https://www.flightradar24.com/", desc: "Most popular global flight tracker with 3D view, airport info, and historical data.", tags: ["live","free"], live: true },
  { cat: "Flight Tracking", icon: "✈️", name: "FlightAware", url: "https://www.flightaware.com/live/", desc: "Real-time flight tracking with delay predictions, route history, and airport activity.", tags: ["live","free"], live: true },
  { cat: "Flight Tracking", icon: "✈️", name: "Planefinder", url: "https://planefinder.net/", desc: "Global real-time flight tracker with augmented reality view and playback.", tags: ["live","free"], live: true },
  { cat: "Flight Tracking", icon: "✈️", name: "OpenSky Network", url: "https://opensky-network.org/network/explorer", desc: "Community-driven ADS-B receiver network with open API and research data.", tags: ["live","free","api"], live: true },
  { cat: "Flight Tracking", icon: "🛩️", name: "ADS-B Exchange Mil", url: "https://globe.adsbexchange.com/?mil=1", desc: "ADS-B Exchange filtered to show only military aircraft.", tags: ["live","free"], live: true },
  { cat: "Flight Tracking", icon: "✈️", name: "Radarbox", url: "https://www.radarbox.com/", desc: "Live flight tracking with airline fleet data and airport statistics.", tags: ["live","free"], live: true },

  // ── Maritime / Ship Tracking ──
  { cat: "Maritime Tracking", icon: "🚢", name: "MarineTraffic", url: "https://www.marinetraffic.com/", desc: "Global ship tracking via AIS. Vessel info, port arrivals, voyage data.", tags: ["live","free"], live: true },
  { cat: "Maritime Tracking", icon: "🚢", name: "VesselFinder", url: "https://www.vesselfinder.com/", desc: "Real-time AIS vessel tracking with port info and vessel database.", tags: ["live","free"], live: true },
  { cat: "Maritime Tracking", icon: "🚢", name: "ShipFinder", url: "https://shipfinder.co/", desc: "Simple AIS-based ship tracking with clean map interface.", tags: ["live","free"], live: true },
  { cat: "Maritime Tracking", icon: "🚢", name: "CruiseMapper", url: "https://www.cruisemapper.com/", desc: "Track cruise ships worldwide with itinerary info and port webcams.", tags: ["live","free"], live: true },
  { cat: "Maritime Tracking", icon: "⚓", name: "BalticShipping", url: "https://www.balticshipping.com/", desc: "Shipping tracker focused on Baltic Sea vessel movements.", tags: ["live","free"], live: true },
  { cat: "Maritime Tracking", icon: "🚢", name: "Windy Waves", url: "https://www.windy.com/waves", desc: "Windy.com wave and swell forecast overlay with ship AIS data.", tags: ["live","free"], live: true },

  // ── Radio Scanners / Live Audio ──
  { cat: "Radio & Audio", icon: "📻", name: "Broadcastify", url: "https://www.broadcastify.com/listen/", desc: "Live police, fire, EMS, aviation, and rail scanner audio feeds worldwide.", tags: ["live","free"], live: true },
  { cat: "Radio & Audio", icon: "📻", name: "LiveATC", url: "https://www.liveatc.net/", desc: "Live air traffic control audio from towers and approach/departure frequencies.", tags: ["live","free"], live: true },
  { cat: "Radio & Audio", icon: "📻", name: "WebSDR", url: "http://www.websdr.org/", desc: "Software-defined radio receivers you can tune from your browser. HF/VHF/UHF.", tags: ["live","free"], live: true },
  { cat: "Radio & Audio", icon: "📻", name: "Radio Garden", url: "https://radio.garden/", desc: "Explore live radio stations around the world on a 3D globe.", tags: ["live","free"], live: true },
  { cat: "Radio & Audio", icon: "📻", name: "OpenMHz", url: "https://openmhz.com/", desc: "Open source trunked radio recorder. Police and fire radio systems.", tags: ["live","free"], live: true },
  { cat: "Radio & Audio", icon: "📡", name: "KiwiSDR", url: "http://kiwisdr.com/public/", desc: "Network of KiwiSDR receivers worldwide. Tune HF bands from browser.", tags: ["live","free"], live: true },

  // ── Live News & TV ──
  { cat: "Live News & TV", icon: "📺", name: "ABC News Live", url: "https://abcnews.go.com/Live", desc: "24/7 free live streaming news from ABC News.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "CBS News 24/7", url: "https://www.cbsnews.com/live/", desc: "Free 24/7 live news stream from CBS.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "NBC News NOW", url: "https://www.nbcnews.com/now", desc: "Free 24/7 live streaming news from NBC.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "Reuters Live", url: "https://www.reuters.com/video/", desc: "Reuters international video and live news coverage.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "Al Jazeera Live", url: "https://www.aljazeera.com/live/", desc: "Al Jazeera English 24/7 live stream. International perspective.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "France 24 Live", url: "https://www.france24.com/en/live", desc: "France 24 English live stream. European/global news.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "DW News Live", url: "https://www.dw.com/en/media-center/live-tv/s-100825", desc: "Deutsche Welle English 24/7 live stream from Germany.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "Sky News Live", url: "https://news.sky.com/watch-live", desc: "Sky News UK free 24/7 live stream.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "NHK World", url: "https://www3.nhk.or.jp/nhkworld/en/live/", desc: "NHK World Japan English 24/7 live stream.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "Euronews Live", url: "https://www.euronews.com/live", desc: "Euronews English live stream. Pan-European news.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "C-SPAN", url: "https://www.c-span.org/networks/", desc: "Live coverage of US Congress, politics, and public affairs.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "Bloomberg Live", url: "https://www.bloomberg.com/live/", desc: "Bloomberg TV live financial news stream.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "CGTN Live", url: "https://www.cgtn.com/tv", desc: "China Global Television Network English 24/7.", tags: ["live","free"], live: true },
  { cat: "Live News & TV", icon: "📺", name: "India Today Live", url: "https://www.indiatoday.in/livetv", desc: "India Today TV 24/7 English live news.", tags: ["live","free"], live: true },

  // ── YouTube Live Streams ──
  { cat: "YouTube Live", icon: "▶️", name: "ABC News (YT)", url: "https://www.youtube.com/@ABCNews/live", desc: "ABC News live stream on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "NBC News (YT)", url: "https://www.youtube.com/@NBCNews/live", desc: "NBC News NOW live stream on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "CBS News (YT)", url: "https://www.youtube.com/@CBSNews/live", desc: "CBS News 24/7 on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "Sky News (YT)", url: "https://www.youtube.com/@SkyNews/live", desc: "Sky News UK live on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "Al Jazeera (YT)", url: "https://www.youtube.com/@AlJazeeraEnglish/live", desc: "Al Jazeera English live on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "DW News (YT)", url: "https://www.youtube.com/@DWNews/live", desc: "DW News English live on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "France 24 (YT)", url: "https://www.youtube.com/@FRANCE24English/live", desc: "France 24 English live on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "LiveNOW from FOX", url: "https://www.youtube.com/@LiveNOWfromFOX/live", desc: "Unfiltered live news from FOX on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "WION (YT)", url: "https://www.youtube.com/@ABORNEESLIVE/live", desc: "WION global news live on YouTube.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "NASA Live", url: "https://www.youtube.com/@NASA/live", desc: "NASA live ISS feed, launches, and events.", tags: ["live","free"], live: true },
  { cat: "YouTube Live", icon: "▶️", name: "Agenda-Free TV", url: "https://www.youtube.com/@AgendaFreeTV/live", desc: "Breaking news scanner-based reporting on YouTube.", tags: ["live","free"], live: true },

  // ── Live Webcams ──
  { cat: "Live Webcams", icon: "📷", name: "EarthCam", url: "https://www.earthcam.com/", desc: "Curated network of live webcams in major cities worldwide.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "Windy Webcams", url: "https://www.windy.com/webcams", desc: "Thousands of live webcams worldwide integrated into Windy weather maps.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "Insecam", url: "http://www.insecam.org/", desc: "Directory of publicly accessible unsecured IP cameras worldwide.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "Skyline Webcams", url: "https://www.skylinewebcams.com/", desc: "HD live webcams from beaches, cities, and landmarks globally.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "WorldCam", url: "https://worldcam.eu/", desc: "European and worldwide webcam directory with search and map view.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "Explore.org", url: "https://explore.org/livecams", desc: "Live nature and wildlife cams — African watering holes, bear cams, oceans.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "DOT Traffic Cams", url: "https://www.511.org/", desc: "US Department of Transportation traffic cameras. State DOT feeds.", tags: ["live","free"], live: true },
  { cat: "Live Webcams", icon: "📷", name: "Jackson Hole Town Sq", url: "https://www.seejh.com/live-webcams/town-square/", desc: "Famous Jackson Hole Wyoming town square live cam.", tags: ["live","free"], live: true },

  // ── Satellite Imagery ──
  { cat: "Satellite & Maps", icon: "🛰️", name: "NASA Worldview", url: "https://worldview.earthdata.nasa.gov/", desc: "Near real-time satellite imagery from NASA. Fires, storms, smoke, ice.", tags: ["live","free"], live: true },
  { cat: "Satellite & Maps", icon: "🛰️", name: "Sentinel Hub", url: "https://apps.sentinel-hub.com/eo-browser/", desc: "ESA Sentinel satellite imagery. Multi-spectral, NDVI, true color.", tags: ["free"] },
  { cat: "Satellite & Maps", icon: "🛰️", name: "Zoom Earth", url: "https://zoom.earth/", desc: "Live satellite weather imagery with storm tracking. Updated every 10 min.", tags: ["live","free"], live: true },
  { cat: "Satellite & Maps", icon: "🗺️", name: "Google Earth Web", url: "https://earth.google.com/web/", desc: "3D satellite view of Earth with Street View, timelapse, and Voyager stories.", tags: ["free"] },
  { cat: "Satellite & Maps", icon: "🗺️", name: "OpenStreetMap", url: "https://www.openstreetmap.org/", desc: "Free, editable world map. The open-source alternative to Google Maps.", tags: ["free"] },
  { cat: "Satellite & Maps", icon: "🛰️", name: "FIRMS Fire Map", url: "https://firms.modaps.eosdis.nasa.gov/map/", desc: "NASA FIRMS active fire / hotspot detection from MODIS and VIIRS satellites.", tags: ["live","free"], live: true },
  { cat: "Satellite & Maps", icon: "🌍", name: "Copernicus Browser", url: "https://browser.dataspace.copernicus.eu/", desc: "ESA Copernicus satellite data browser. Free Sentinel-1/2/3/5P data.", tags: ["free"] },
  { cat: "Satellite & Maps", icon: "🛰️", name: "GOES Satellite", url: "https://www.star.nesdis.noaa.gov/goes/", desc: "NOAA GOES satellite imagery — real-time weather satellite views of Americas.", tags: ["live","free"], live: true },
  { cat: "Satellite & Maps", icon: "🛰️", name: "Himawari Satellite", url: "https://himawari8.nict.go.jp/", desc: "Japanese Himawari-8/9 geostationary satellite — Asia/Pacific real-time.", tags: ["live","free"], live: true },

  // ── Weather & Natural Disasters ──
  { cat: "Weather & Disasters", icon: "🌪️", name: "Windy.com", url: "https://www.windy.com/", desc: "Powerful weather visualization with wind, rain, temp, pressure layers.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🌪️", name: "NOAA Weather", url: "https://www.weather.gov/", desc: "US National Weather Service forecasts, watches, warnings.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🌊", name: "USGS Earthquakes", url: "https://earthquake.usgs.gov/earthquakes/map/", desc: "Real-time earthquake map from USGS. All quakes in last 24h/7d/30d.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🌋", name: "Smithsonian Volcanoes", url: "https://volcano.si.edu/gvp_currenteruptions.cfm", desc: "Smithsonian Global Volcanism Program — current eruptions and activity.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🔥", name: "NIFC Wildfire Map", url: "https://www.nifc.gov/fire-information/nfn", desc: "National Interagency Fire Center wildfire situation maps.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🌀", name: "Tropical Tidbits", url: "https://www.tropicaltidbits.com/", desc: "Tropical cyclone tracking, model forecasts, satellite loops.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "⚡", name: "Blitzortung Lightning", url: "https://www.blitzortung.org/en/live_lightning_maps.php", desc: "Real-time lightning strike map from global sensor network.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🌊", name: "GDACS", url: "https://www.gdacs.org/", desc: "Global Disaster Alerting System — earthquakes, floods, cyclones, volcanoes.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "☢️", name: "RSOE EDIS", url: "https://rsoe-edis.org/eventMap", desc: "Emergency and Disaster Information Service — global incident map.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🌊", name: "Ventusky", url: "https://www.ventusky.com/", desc: "Beautiful weather visualization — wind, rain, temperature, snow, waves.", tags: ["live","free"], live: true },
  { cat: "Weather & Disasters", icon: "🏔️", name: "Avalanche.org", url: "https://avalanche.org/", desc: "US avalanche forecasts and danger ratings by region.", tags: ["live","free"], live: true },

  // ── Conflict / Crisis Monitoring ──
  { cat: "Conflict & Crisis", icon: "⚔️", name: "Liveuamap", url: "https://liveuamap.com/", desc: "Interactive conflict map with geolocated events, news, and military movements.", tags: ["live","free"], live: true },
  { cat: "Conflict & Crisis", icon: "⚔️", name: "ACLED Dashboard", url: "https://acleddata.com/dashboard/", desc: "Armed Conflict Location & Event Data — political violence and protest tracker.", tags: ["free"] },
  { cat: "Conflict & Crisis", icon: "⚔️", name: "Conflict Observatory", url: "https://hub.conflictobservatory.org/", desc: "Satellite-based monitoring of conflict zones. Yale HRL program.", tags: ["free"] },
  { cat: "Conflict & Crisis", icon: "🚨", name: "ReliefWeb", url: "https://reliefweb.int/", desc: "UN OCHA humanitarian crisis reporting. Disasters, conflicts, updates.", tags: ["live","free"], live: true },
  { cat: "Conflict & Crisis", icon: "🗺️", name: "Syria Liveuamap", url: "https://syria.liveuamap.com/", desc: "Liveuamap focused on the Syrian conflict.", tags: ["live","free"], live: true },
  { cat: "Conflict & Crisis", icon: "💣", name: "Bellingcat", url: "https://www.bellingcat.com/", desc: "Open source investigative journalism. Conflict, crime, accountability.", tags: ["free"] },
  { cat: "Conflict & Crisis", icon: "🚨", name: "FEMA Disasters", url: "https://www.fema.gov/disasters", desc: "FEMA current disaster declarations and emergency alerts for the US.", tags: ["live","free"], live: true },

  // ── Social Media OSINT ──
  { cat: "Social Media", icon: "🐦", name: "X / Twitter Search", url: "https://x.com/search", desc: "Advanced Twitter/X search. Use operators: from: since: until: geocode:", tags: ["free"] },
  { cat: "Social Media", icon: "🐦", name: "Nitter", url: "https://nitter.net/", desc: "Privacy-focused Twitter frontend. No JS, no tracking, no login required.", tags: ["free"] },
  { cat: "Social Media", icon: "📱", name: "Reddit Search", url: "https://www.reddit.com/search/", desc: "Search Reddit posts and comments. Use site:reddit.com on Google for deeper search.", tags: ["free"] },
  { cat: "Social Media", icon: "📱", name: "Pushshift Reddit", url: "https://camas.unddit.com/", desc: "Search deleted/removed Reddit content via Pushshift archive.", tags: ["free"] },
  { cat: "Social Media", icon: "✈️", name: "Telegram Search", url: "https://t.me/s/", desc: "Telegram public channel search. Many OSINT groups share intel here.", tags: ["free"] },
  { cat: "Social Media", icon: "📸", name: "Instagram (Dumpor)", url: "https://dumpor.com/", desc: "Browse Instagram profiles, stories, and hashtags without login.", tags: ["free"] },
  { cat: "Social Media", icon: "🎵", name: "TikTok Search", url: "https://www.tiktok.com/search", desc: "Search TikTok videos. Useful for real-time event footage.", tags: ["free"] },
  { cat: "Social Media", icon: "📍", name: "Snapchat Map", url: "https://map.snapchat.com/", desc: "Snap Map — view public Snapchat stories geolocated on a world map.", tags: ["live","free"], live: true },
  { cat: "Social Media", icon: "📱", name: "Social Searcher", url: "https://www.social-searcher.com/", desc: "Free social media search engine across multiple platforms.", tags: ["free"] },

  // ── Geolocation Tools ──
  { cat: "Geolocation", icon: "📍", name: "Google Maps", url: "https://www.google.com/maps", desc: "Street View, satellite, terrain, traffic, transit layers.", tags: ["free"] },
  { cat: "Geolocation", icon: "📍", name: "Google Earth Timelapse", url: "https://earthengine.google.com/timelapse/", desc: "35+ years of satellite imagery timelapse. See how locations changed.", tags: ["free"] },
  { cat: "Geolocation", icon: "☀️", name: "SunCalc", url: "https://www.suncalc.org/", desc: "Sun position and shadow calculator. Verify time of photos from shadows.", tags: ["free"] },
  { cat: "Geolocation", icon: "🧭", name: "What3Words", url: "https://what3words.com/", desc: "3-word address system for precise location sharing.", tags: ["free"] },
  { cat: "Geolocation", icon: "🗺️", name: "Wikimapia", url: "https://wikimapia.org/", desc: "User-annotated world map with building/location descriptions.", tags: ["free"] },
  { cat: "Geolocation", icon: "📍", name: "Mapillary", url: "https://www.mapillary.com/app/", desc: "Crowdsourced street-level imagery. Alternative to Google Street View.", tags: ["free"] },
  { cat: "Geolocation", icon: "📍", name: "KartaView", url: "https://kartaview.org/map/", desc: "OpenStreetCam street-level imagery. Open source Street View.", tags: ["free"] },
  { cat: "Geolocation", icon: "📍", name: "Yandex Maps", url: "https://yandex.com/maps/", desc: "Russian map service with street view. Better coverage in Russia/CIS.", tags: ["free"] },
  { cat: "Geolocation", icon: "📐", name: "CalcMaps", url: "https://www.calcmaps.com/", desc: "Measure area, distance, perimeter on map. Draw radius circles.", tags: ["free"] },
  { cat: "Geolocation", icon: "🌐", name: "GeoGuessr", url: "https://www.geoguessr.com/", desc: "Geography guessing game using Street View. Great for geolocation practice.", tags: ["free"] },

  // ── Cyber / Network OSINT ──
  { cat: "Cyber & Network", icon: "🔍", name: "Shodan", url: "https://www.shodan.io/", desc: "Search engine for internet-connected devices. Find servers, cameras, IoT.", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🔍", name: "Censys", url: "https://search.censys.io/", desc: "Internet-wide scanning. Discover hosts, certificates, services.", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🛡️", name: "VirusTotal", url: "https://www.virustotal.com/", desc: "Scan files, URLs, IPs, and domains with 70+ antivirus engines.", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🌐", name: "SecurityTrails", url: "https://securitytrails.com/", desc: "Historical DNS data, WHOIS, subdomain finder, IP explorer.", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🌐", name: "crt.sh", url: "https://crt.sh/", desc: "Certificate Transparency log search. Find SSL certs for any domain.", tags: ["free"] },
  { cat: "Cyber & Network", icon: "🔓", name: "Have I Been Pwned", url: "https://haveibeenpwned.com/", desc: "Check if your email/phone has been in a data breach.", tags: ["free"] },
  { cat: "Cyber & Network", icon: "🌐", name: "Netcraft", url: "https://www.netcraft.com/", desc: "Website technology lookup, hosting history, phishing detection.", tags: ["free"] },
  { cat: "Cyber & Network", icon: "📧", name: "Hunter.io", url: "https://hunter.io/", desc: "Find professional email addresses associated with any domain.", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🌐", name: "BuiltWith", url: "https://builtwith.com/", desc: "Technology profiler — see what tech stack any website uses.", tags: ["free"] },
  { cat: "Cyber & Network", icon: "📡", name: "Wigle.net", url: "https://wigle.net/", desc: "Wireless network mapping. Search WiFi networks and cell towers by location.", tags: ["free"] },
  { cat: "Cyber & Network", icon: "🌐", name: "URLScan.io", url: "https://urlscan.io/", desc: "Scan and analyze URLs. See requests, DOM, cookies, links.", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🌐", name: "DNSdumpster", url: "https://dnsdumpster.com/", desc: "DNS reconnaissance. Find subdomains, MX, TXT, host records.", tags: ["free"] },
  { cat: "Cyber & Network", icon: "📊", name: "GreyNoise", url: "https://viz.greynoise.io/", desc: "IP context — is this IP scanning the internet? Benign or malicious?", tags: ["free","api"] },
  { cat: "Cyber & Network", icon: "🔐", name: "LeakIX", url: "https://leakix.net/", desc: "Search engine for exposed services, databases, and misconfigurations.", tags: ["free"] },

  // ── Domain & WHOIS ──
  { cat: "Domain & WHOIS", icon: "🌐", name: "WHOIS Lookup", url: "https://whois.domaintools.com/", desc: "Domain WHOIS lookup — registration, expiry, registrar, nameservers.", tags: ["free"] },
  { cat: "Domain & WHOIS", icon: "🌐", name: "ViewDNS.info", url: "https://viewdns.info/", desc: "20+ DNS tools — reverse IP, port scanner, WHOIS, firewall detect.", tags: ["free"] },
  { cat: "Domain & WHOIS", icon: "🌐", name: "MXToolbox", url: "https://mxtoolbox.com/", desc: "MX, DNS, blacklist, SMTP diagnostics for any domain.", tags: ["free"] },
  { cat: "Domain & WHOIS", icon: "📜", name: "Wayback Machine", url: "https://web.archive.org/", desc: "Internet Archive. View cached/historical versions of any website.", tags: ["free"] },
  { cat: "Domain & WHOIS", icon: "🕸️", name: "Wayback URLs", url: "https://web.archive.org/cdx/search/cdx", desc: "Wayback Machine CDX API — search all archived URLs for a domain.", tags: ["free","api"] },
  { cat: "Domain & WHOIS", icon: "🔗", name: "URLhaus", url: "https://urlhaus.abuse.ch/", desc: "Malicious URL database. Search and report bad URLs.", tags: ["free"] },

  // ── Image & Video Analysis ──
  { cat: "Image & Video", icon: "🖼️", name: "Google Reverse Image", url: "https://images.google.com/", desc: "Reverse image search. Drag/paste image to find matches and sources.", tags: ["free"] },
  { cat: "Image & Video", icon: "🖼️", name: "TinEye", url: "https://tineye.com/", desc: "Reverse image search engine. Find where an image appears online.", tags: ["free"] },
  { cat: "Image & Video", icon: "🖼️", name: "Yandex Images", url: "https://yandex.com/images/", desc: "Yandex reverse image search — often finds results Google misses, especially faces.", tags: ["free"] },
  { cat: "Image & Video", icon: "🖼️", name: "Bing Visual Search", url: "https://www.bing.com/visualsearch", desc: "Microsoft Bing reverse image search.", tags: ["free"] },
  { cat: "Image & Video", icon: "📷", name: "FotoForensics", url: "https://fotoforensics.com/", desc: "Image forensics — ELA analysis, EXIF data, metadata extraction.", tags: ["free"] },
  { cat: "Image & Video", icon: "📷", name: "Jeffrey EXIF Viewer", url: "https://exif.regex.info/exif.cgi", desc: "Extract and display EXIF/metadata from images.", tags: ["free"] },
  { cat: "Image & Video", icon: "🎥", name: "InVID Verification", url: "https://www.invid-project.eu/tools-and-services/invid-verification-plugin/", desc: "Video/image verification plugin. Reverse search keyframes, check context.", tags: ["free"] },
  { cat: "Image & Video", icon: "📷", name: "PimEyes", url: "https://pimeyes.com/", desc: "Face recognition search engine. Find where a face appears online.", tags: ["free"] },
  { cat: "Image & Video", icon: "🖼️", name: "ImgOps", url: "https://imgops.com/", desc: "All-in-one image operations: reverse search, EXIF, edit, resize.", tags: ["free"] },

  // ── People & Public Records ──
  { cat: "People & Records", icon: "👤", name: "Pipl", url: "https://pipl.com/", desc: "People search engine. Find contact info, social profiles, public records.", tags: ["api"] },
  { cat: "People & Records", icon: "👤", name: "That's Them", url: "https://thatsthem.com/", desc: "Free people search — name, email, phone, address, IP lookup.", tags: ["free"] },
  { cat: "People & Records", icon: "👤", name: "Whitepages", url: "https://www.whitepages.com/", desc: "People and phone number lookup. Reverse phone, address, background checks.", tags: ["free"] },
  { cat: "People & Records", icon: "🔍", name: "Namechk", url: "https://namechk.com/", desc: "Check username availability across hundreds of social media sites.", tags: ["free"] },
  { cat: "People & Records", icon: "🔍", name: "WhatsMyName", url: "https://whatsmyname.app/", desc: "Username enumeration across 500+ websites.", tags: ["free"] },
  { cat: "People & Records", icon: "📧", name: "Epieos", url: "https://epieos.com/", desc: "Find accounts linked to an email or phone number.", tags: ["free"] },
  { cat: "People & Records", icon: "📋", name: "PACER", url: "https://pacer.uscourts.gov/", desc: "US federal court records. Cases, dockets, filings.", tags: ["free"] },
  { cat: "People & Records", icon: "🏢", name: "OpenCorporates", url: "https://opencorporates.com/", desc: "World's largest open database of companies. 200+ million companies.", tags: ["free"] },
  { cat: "People & Records", icon: "💰", name: "OFAC Sanctions", url: "https://sanctionssearch.ofac.treas.gov/", desc: "US Treasury OFAC sanctions list search. SDN and blocked persons.", tags: ["free"] },
  { cat: "People & Records", icon: "📋", name: "ICIJ Offshore Leaks", url: "https://offshoreleaks.icij.org/", desc: "Panama Papers, Paradise Papers — search offshore entity database.", tags: ["free"] },

  // ── Traffic & Transit ──
  { cat: "Traffic & Transit", icon: "🚗", name: "Google Traffic", url: "https://www.google.com/maps/@0,0,3z/data=!5m1!1e1", desc: "Google Maps with live traffic overlay. See congestion worldwide.", tags: ["live","free"], live: true },
  { cat: "Traffic & Transit", icon: "🚗", name: "Waze Live Map", url: "https://www.waze.com/live-map/", desc: "Community-driven traffic, police, hazard, and road closure reports.", tags: ["live","free"], live: true },
  { cat: "Traffic & Transit", icon: "🚂", name: "OpenRailwayMap", url: "https://www.openrailwaymap.org/", desc: "Global railway infrastructure map built on OpenStreetMap.", tags: ["free"] },
  { cat: "Traffic & Transit", icon: "🚌", name: "Transit App", url: "https://transitapp.com/", desc: "Real-time public transit tracking — buses, trains, ferries.", tags: ["live","free"], live: true },
  { cat: "Traffic & Transit", icon: "🛤️", name: "Flightradar Rail", url: "https://www.openrailwaymap.org/", desc: "Live train tracking in Europe and select regions.", tags: ["live","free"], live: true },

  // ── Space & Satellites ──
  { cat: "Space & Satellites", icon: "🛰️", name: "N2YO Satellite Tracker", url: "https://www.n2yo.com/", desc: "Track satellites, ISS, Starlink, and debris in real-time.", tags: ["live","free"], live: true },
  { cat: "Space & Satellites", icon: "🛰️", name: "Heavens Above", url: "https://www.heavens-above.com/", desc: "Satellite pass predictions, ISS visibility, Starlink trains.", tags: ["live","free"], live: true },
  { cat: "Space & Satellites", icon: "🔭", name: "Stellarium Web", url: "https://stellarium-web.org/", desc: "Online planetarium. See what's in the sky from any location and time.", tags: ["free"] },
  { cat: "Space & Satellites", icon: "☀️", name: "SpaceWeatherLive", url: "https://www.spaceweatherlive.com/", desc: "Solar activity, aurora forecast, CME tracking, solar flare alerts.", tags: ["live","free"], live: true },
  { cat: "Space & Satellites", icon: "🚀", name: "Next Spaceflight", url: "https://nextspaceflight.com/", desc: "Upcoming rocket launches worldwide with countdown timers.", tags: ["live","free"], live: true },

  // ── Miscellaneous OSINT ──
  { cat: "Misc OSINT Tools", icon: "🔧", name: "OSINT Framework", url: "https://osintframework.com/", desc: "Master directory of OSINT tools organized by category. The OSINT bible.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "🔧", name: "IntelTechniques", url: "https://inteltechniques.com/tools/", desc: "Michael Bazzell's OSINT tools and search portal.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "📊", name: "Maltego CE", url: "https://www.maltego.com/", desc: "OSINT and link analysis tool. Visualize relationships between entities.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "🌐", name: "Shodan Maps", url: "https://maps.shodan.io/", desc: "Geographic visualization of Shodan data — see devices on a world map.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "🗓️", name: "CachedView", url: "https://cachedview.nl/", desc: "View Google cached version of any webpage.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "📋", name: "Pastebin Search", url: "https://psbdmp.ws/", desc: "Search Pastebin dumps. Find leaked data, code snippets.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "🔍", name: "SpiderFoot", url: "https://www.spiderfoot.net/", desc: "Open source OSINT automation. Scan IPs, domains, emails, names.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "📡", name: "Shodan CLI", url: "https://cli.shodan.io/", desc: "Command-line interface for Shodan. Quick device/network lookups.", tags: ["free","api"] },
  { cat: "Misc OSINT Tools", icon: "🔍", name: "theHarvester", url: "https://github.com/laramies/theHarvester", desc: "Email, subdomain, and name harvester from public sources.", tags: ["free"] },
  { cat: "Misc OSINT Tools", icon: "🔗", name: "Recon-ng", url: "https://github.com/lanmaster53/recon-ng", desc: "Web reconnaissance framework. Modular OSINT tool like Metasploit.", tags: ["free"] },
];

// Category metadata — icon + color
const CAT_META = {
  "Flight Tracking":    { icon: "✈️",  color: "#3b82f6" },
  "Maritime Tracking":  { icon: "🚢",  color: "#06b6d4" },
  "Radio & Audio":      { icon: "📻",  color: "#f59e0b" },
  "Live News & TV":     { icon: "📺",  color: "#ef4444" },
  "YouTube Live":       { icon: "▶️",  color: "#ff0000" },
  "Live Webcams":       { icon: "📷",  color: "#22c55e" },
  "Satellite & Maps":   { icon: "🛰️", color: "#a855f7" },
  "Weather & Disasters":{ icon: "🌪️", color: "#f97316" },
  "Conflict & Crisis":  { icon: "⚔️",  color: "#ef4444" },
  "Social Media":       { icon: "📱",  color: "#3b82f6" },
  "Geolocation":        { icon: "📍",  color: "#22c55e" },
  "Cyber & Network":    { icon: "🔍",  color: "#a855f7" },
  "Domain & WHOIS":     { icon: "🌐",  color: "#06b6d4" },
  "Image & Video":      { icon: "🖼️", color: "#ec4899" },
  "People & Records":   { icon: "👤",  color: "#f59e0b" },
  "Traffic & Transit":  { icon: "🚗",  color: "#22c55e" },
  "Space & Satellites": { icon: "🛰️", color: "#a855f7" },
  "Misc OSINT Tools":   { icon: "🔧",  color: "#6b7394" },
};

// ── State ──
let favorites = JSON.parse(localStorage.getItem("osint-favs") || "[]");
let showFavOnly = false;
let collapsedCats = JSON.parse(localStorage.getItem("osint-collapsed") || "[]");

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  buildUI();
  bindEvents();
  updateCount();
});

function buildUI() {
  const cats = getCategories();
  buildSidebar(cats);
  buildCards(cats);
}

function getCategories() {
  const map = {};
  TOOLS.forEach(t => {
    if (!map[t.cat]) map[t.cat] = [];
    map[t.cat].push(t);
  });
  return map;
}

// ── Sidebar ──
function buildSidebar(cats) {
  const nav = document.getElementById("category-nav");
  nav.innerHTML = "";
  Object.keys(cats).forEach(cat => {
    const m = CAT_META[cat] || { icon: "📁", color: "#6b7394" };
    const li = document.createElement("li");
    li.dataset.cat = cat;
    li.innerHTML = `<span class="nav-icon">${m.icon}</span><span>${cat}</span><span class="nav-count">${cats[cat].length}</span>`;
    li.addEventListener("click", () => {
      const el = document.getElementById("cat-" + slugify(cat));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
    nav.appendChild(li);
  });
}

// ── Cards ──
function buildCards(cats) {
  const container = document.getElementById("categories-container");
  container.innerHTML = "";

  Object.keys(cats).forEach(cat => {
    const m = CAT_META[cat] || { icon: "📁", color: "#6b7394" };
    const section = document.createElement("section");
    section.className = "category-section" + (collapsedCats.includes(cat) ? " collapsed" : "");
    section.id = "cat-" + slugify(cat);

    const header = document.createElement("div");
    header.className = "category-header";
    header.innerHTML = `
      <span class="cat-icon">${m.icon}</span>
      <span class="cat-title">${cat}</span>
      <span class="cat-count">${cats[cat].length} tools</span>
      <span class="cat-chevron">▼</span>
    `;
    header.addEventListener("click", () => {
      section.classList.toggle("collapsed");
      saveCollapsed();
    });

    const grid = document.createElement("div");
    grid.className = "card-grid";

    cats[cat].forEach(tool => {
      grid.appendChild(createCard(tool));
    });

    section.appendChild(header);
    section.appendChild(grid);
    container.appendChild(section);
  });
}

function createCard(tool) {
  const card = document.createElement("div");
  card.className = "tool-card";
  card.dataset.name = tool.name.toLowerCase();
  card.dataset.desc = tool.desc.toLowerCase();
  card.dataset.cat = tool.cat.toLowerCase();
  card.dataset.tags = (tool.tags || []).join(" ");

  const isFav = favorites.includes(tool.name);
  const liveHTML = tool.live ? `<span class="live-badge"><span class="live-dot"></span>LIVE</span>` : "";
  const tagsHTML = (tool.tags || []).map(t => `<span class="tag tag-${t}">${t}</span>`).join("");

  card.innerHTML = `
    <button class="fav-btn ${isFav ? "is-fav" : ""}" title="Toggle favorite" data-name="${tool.name}">&#9733;</button>
    <div class="card-top">
      <span class="card-icon">${tool.icon}</span>
      <div class="card-info">
        <div class="card-title">
          <a href="${tool.url}" target="_blank" rel="noopener">${tool.name}</a>
          ${liveHTML}
        </div>
        <div class="card-desc">${tool.desc}</div>
      </div>
    </div>
    <div class="card-tags">${tagsHTML}</div>
    <div class="card-actions">
      <a href="${tool.url}" target="_blank" rel="noopener" class="open-btn">Open ↗</a>
    </div>
  `;

  return card;
}

// ── Events ──
function bindEvents() {
  // Search
  const search = document.getElementById("search");
  search.addEventListener("input", filterTools);
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      search.focus();
      search.select();
    }
    if (e.key === "Escape") {
      search.value = "";
      filterTools();
      search.blur();
    }
  });

  // Sidebar toggle
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
    sidebar.classList.toggle("mobile-open");
    document.body.classList.toggle("sidebar-collapsed");
  });

  // Expand / collapse all
  document.getElementById("expand-all-btn").addEventListener("click", () => {
    document.querySelectorAll(".category-section").forEach(s => s.classList.remove("collapsed"));
    collapsedCats = [];
    saveCollapsed();
  });
  document.getElementById("collapse-all-btn").addEventListener("click", () => {
    document.querySelectorAll(".category-section").forEach(s => s.classList.add("collapsed"));
    collapsedCats = Object.keys(getCategories());
    saveCollapsed();
  });

  // Favorites filter
  document.getElementById("favorites-filter").addEventListener("click", function () {
    showFavOnly = !showFavOnly;
    this.classList.toggle("active", showFavOnly);
    filterTools();
  });

  // Delegate fav clicks
  document.getElementById("categories-container").addEventListener("click", e => {
    const btn = e.target.closest(".fav-btn");
    if (!btn) return;
    e.preventDefault();
    const name = btn.dataset.name;
    if (favorites.includes(name)) {
      favorites = favorites.filter(f => f !== name);
      btn.classList.remove("is-fav");
    } else {
      favorites.push(name);
      btn.classList.add("is-fav");
    }
    localStorage.setItem("osint-favs", JSON.stringify(favorites));
    if (showFavOnly) filterTools();
    updateCount();
  });
}

// ── Filter ──
function filterTools() {
  const q = document.getElementById("search").value.toLowerCase().trim();
  let anyVisible = false;

  document.querySelectorAll(".category-section").forEach(section => {
    let catVisible = false;
    section.querySelectorAll(".tool-card").forEach(card => {
      const matchText = !q ||
        card.dataset.name.includes(q) ||
        card.dataset.desc.includes(q) ||
        card.dataset.cat.includes(q) ||
        card.dataset.tags.includes(q);
      const matchFav = !showFavOnly || favorites.includes(card.querySelector(".fav-btn").dataset.name);
      const show = matchText && matchFav;
      card.classList.toggle("hidden", !show);
      if (show) catVisible = true;
    });
    section.classList.toggle("hidden", !catVisible);
    if (catVisible) anyVisible = true;
  });

  document.getElementById("no-results").classList.toggle("hidden", anyVisible);
  updateCount();
}

function updateCount() {
  const visible = document.querySelectorAll(".tool-card:not(.hidden)").length;
  document.getElementById("tool-count").textContent = `${visible} / ${TOOLS.length} tools`;
}

// ── Helpers ──
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function saveCollapsed() {
  collapsedCats = [];
  document.querySelectorAll(".category-section.collapsed").forEach(s => {
    const title = s.querySelector(".cat-title");
    if (title) collapsedCats.push(title.textContent);
  });
  localStorage.setItem("osint-collapsed", JSON.stringify(collapsedCats));
}
