var Kothic = (function () {

	function render(canvasId, data, zoom, onRenderComplete, buffered) {
		
		var canvas, ctx,
			buffer, realCtx,
			width, height,
			granularity,
			ws, hs,
			layers = {}, 
			layerIds = [],
			styleCache = {},
			collides,
			dashPattern,
			pathOpened;
			
		var start,
			layersStyled,
			mapRendered,
			finish;
	
		start = +new Date();
		
		
		// init all variables
		
		canvas = (typeof canvasId == 'string' ? document.getElementById(canvasId) : canvasId);
		ctx = canvas.getContext('2d');
		
		width = canvas.width;
		height = canvas.height;
		
		if (buffered) {
			realCtx = ctx;
			buffer = document.createElement('canvas');
			buffer.width = width;
			buffer.height = height;
			ctx = buffer.getContext('2d');
		}
		
		granularity = data.granularity;
		ws = width / granularity;
		hs = height / granularity;
		
		collides = new CollisionBuffer();
		collides.addBox([0,0,width,0]);
		collides.addBox([0,height,width,height]);
		collides.addBox([width,0,width,height]);
		collides.addBox([0,0,0,height]);
		
		
		// style and populate layer structures

		populateLayers(data, zoom);

		layersStyled = +new Date();
		
		
		// render
		
		setStyles({
			strokeStyle: "rgba(0,0,0,0.5)",
			fillStyle: "rgba(0,0,0,0.5)",
			lineWidth: 1,
			lineCap: "round",
			lineJoin: "round"
		});
		
		var layersLen = layerIds.length, 
			i, j, features, featuresLen;
	
		setTimeout(renderMap, 0);
		
		function renderMap() {
			renderBackground(zoom);
			
			for (i = 0; i < layersLen; i++) {
				features = layers[layerIds[i]];
				featuresLen = features.length;
				
				for (j = 0; j < featuresLen; j++) {
					renderPolygonFill(features[j], features[j+1]);
				}
	
				ctx.lineCap = "butt";
					
				for (j = 0; j < featuresLen; j++) {
					renderCasing(features[j], features[j+1]);
				}
				ctx.lineCap = "round";
	
				for (j = 0; j < featuresLen; j++) {
					renderPolyline(features[j], features[j+1]);
				}
	
				mapRendered = +new Date();
			}
			
			setTimeout(renderIconsAndText, 0);
		}

		function renderIconsAndText() {
			
			for (i = layersLen - 1; i >= 0; i--) {
				
				features = layers[layerIds[i]];
				featuresLen = features.length;
				
				if (!featuresLen) continue;
				
				for (j = featuresLen - 1; j >= 0; j--) {
					renderIcon(features[j]);
				}
				for (j = featuresLen - 1; j >= 0; j--) {
					renderText(features[j]);
				}
			}
			
			finish = +new Date();
			
			if (buffered) {
				realCtx.drawImage(buffer, 0, 0);
			}
			
			onRenderComplete(getDebugInfo());
		}
		
		
		function getDebugInfo() {
			return (layersStyled - start) + ': layers styled<br />' +
					(mapRendered - layersStyled) + ': map rendered<br />' + 
					(finish - mapRendered) + ': icons/text rendered<br />' + 
					(finish - start) + ': total<br />';
		}
		
		function renderPolygonFill(feature, nextFeature) {
			var style = feature.style, fillStyle;
			if (!('fill-color' in style)) return;
			
			pathGeoJSON(feature, false, true);
			
			if (!nextFeature || (nextFeature.style !== style)) {
				ctx.save();
				
				if ('fill-image' in style) {
					var image = MapCSS.getImageAsTexture(style['fill-image']);
					fillStyle = ctx.createPattern(image, 'repeat');
				} else {
					fillStyle = style["fill-color"];
				}

				setStyles({
					fillStyle: fillStyle,
					globalAlpha: style["fill-opacity"] || style.opacity
				});
				
				pathOpened = false;

				ctx.fill();
				
				ctx.restore();
			}
		}
		
		function renderCasing(feature, nextFeature) {
			var style = feature.style;
			if (!("casing-width" in style)) return;
			
			var dashes = style["casing-dashes"] || style.dashes || false;
			
			pathGeoJSON(feature, dashes);

			if (!nextFeature || (nextFeature.style !== style)) {
				ctx.save();
				
				setStyles({
					lineWidth: 2 * style["casing-width"] + ("width" in style ? style["width"] : 0),
					strokeStyle: style["casing-color"] || style["color"],
					lineCap: style["casing-linecap"] || style["linecap"],
					lineJoin: style["casing-linejoin"] || style["linejoin"],
					globalAlpha: style["casing-opacity"] || style["opacity"]
				});
				
				pathOpened = false;
				ctx.stroke();
			
				ctx.restore();
			}
		}
		
		function renderPolyline(feature, nextFeature) {
			var style = feature.style;
			if (!("width" in style)) return;
			
			var dashes = style.dashes;
			
			pathGeoJSON(feature, dashes);
			
			if (!nextFeature || (nextFeature.style !== style)) {
				ctx.save();
				
				setStyles({
					lineWidth: style.width,
					strokeStyle: style.color,
					lineCap: style.linecap,
					lineJoin: style.linejoin,
					globalAlpha: style.opacity
				});
				
				pathOpened = false;
				ctx.stroke();
			
				ctx.restore();
			}
		}
		
		function renderBackground(zoom) {
			var style = MapCSS.restyle({}, zoom, "canvas", "canvas")['default'];
			
			ctx.save();
			
			setStyles({
				fillStyle: style["fill-color"],
				globalAlpha: style["fill-opacity"] || style.opacity
			});
			
			ctx.fillRect(-1, -1, width+1, height+1);
			
			ctx.restore();
		}
		
		function renderIcon(feature) {
			var style = feature.style;
			if (!("icon-image" in style)) return;
			
			ctx.save();
			
			var img = MapCSS.getImage(style["icon-image"]),
				offset = 0,
				opacity = 1,
				mindistance = 0,
				textwidth = 0;
			if (!img) {return;}
				
			setStyles({
				fillStyle: style["text-color"] || "#000000",
				lineWidth: style["text-halo-radius"] + 2,
				strokeStyle: style["text-halo-color"] || "#ffffff"
			});
			if ("text-offset" in style){offset = style["text-offset"];}
			if ("opacity" in style){opacity = style.opacity;}
			if ("text-opacity" in style){opacity = style["text-opacity"];}
			if ("-x-mapnik-min-distance" in style){mindistance = style["-x-mapnik-min-distance"];}
			
			var point;
			if (feature.type == "Point") { 
				point = [ws * feature.coordinates[0], hs * (granularity - feature.coordinates[1])];
			}
			if (feature.type == "Polygon") { 
				point = [ws * feature.reprpoint[0], hs * (granularity - feature.reprpoint[1])];
			}
			if (style["text"]){ctx.font = fontString(style["font-family"],style["font-size"]);}
			if (collides.checkPointWH(point, img.width, img.height)) return;
			if (style["text"]){
				textwidth = ctx.measureText(style["text"]).width;
				if (style["text-allow-overlap"]!="true" && collides.checkPointWH([point[0],point[1]+offset], textwidth, 10)) return;
			}
			if (opacity <1){
				ctx.fillStyle = new RGBColor(ctx.fillStyle, opacity).toRGBA();
				ctx.strokeStyle = new RGBColor(ctx.strokeStyle, opacity).toRGBA();
			}
			
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			
			if(style["text"]){
				if ("text-halo-radius" in style)
					ctx.strokeText(style["text"], point[0],point[1]+offset);
				ctx.fillText(style["text"], point[0],point[1]+offset);
			}
			
			ctx.drawImage(img.sprite, 
				0, img.offset, img.width, img.height, 
				point[0] - img.width / 2, point[1] - img.height / 2, img.width, img.height);
			
			collides.addPointWH(point, img.width, img.height, mindistance); //TOFIX: img won't have width and height until load 
			collides.addPointWH([point[0], point[1] + offset], textwidth, 10, mindistance);
			
			ctx.restore();
		}
		
		function renderText(feature) {
			var style = feature.style;
			if (!style['text'] || ("icon-image" in style)) return; 

			ctx.save();

			setStyles({
				fillStyle: style["text-color"] || "#000000",
				lineWidth: style["text-halo-radius"] + 2,
				strokeStyle: style["text-halo-color"] || "#ffffff",
				font: fontString(style["font-family"], style["font-size"])
			});
			
			var offset = style["text-offset"] || 0,
				opacity = style["text-opacity"] || style["opacity"] || 1,
				mindistance = style["-x-mapnik-min-distance"] || 0,
				textwidth = ctx.measureText(style["text"]).width;
		
			var coords;
			
			switch (feature.type) {
				case 'Point': coords = feature.coordinates; break;
				case 'Polygon': coords = feature.reprpoint; break;
				case 'LineString': coords = feature.coordinates[0]; break;
				case 'GeometryCollection': //TODO: Disassemble geometry collection
				case 'MultiPoint': //TODO: Disassemble multi point
				case 'MultiPolygon': //TODO: Disassemble multi polygon
				case 'MultiLineString': ctx.restore(); return; //TODO: Disassemble multi line string
			}
			var x = ws * coords[0],
				y = hs * (granularity - coords[1]) + offset,
				point = [x, y];
			
			if ((style["text-allow-overlap"]!="true") && collides.checkPointWH(point, textwidth, 5)) return;
			
			if (opacity < 1){
				ctx.fillStyle = new RGBColor(ctx.fillStyle, opacity).toRGBA();
				ctx.strokeStyle = new RGBColor(ctx.strokeStyle, opacity).toRGBA();
			}
			
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			
			if (feature.type=="Polygon" || feature.type == "Point") {
				if ("text-halo-radius" in style) ctx.strokeText(style["text"], x, y);
				ctx.fillText(style["text"], x, y);
				collides.addPointWH(point, textwidth, 10, mindistance);
			} else { // LineString
				textOnGeoJSON(feature, ("text-halo-radius" in style), style["text"]);
			}
			
			ctx.restore();		
		}
		
		function styleFeatures(features, zoom) {
			var styledFeatures = [],
				i, j, len, feature, style, restyledFeature;
			
			for (i = 0, len = features.length; i < len; i++) {
				feature = features[i];
		
				var styleKey = JSON.stringify(feature.properties) + ':' + zoom + ':' + feature.type;
				if (styleKey in styleCache) {
					style = styleCache[styleKey];
				} else {
	                //TODO: propagate type and selector
	                var type, selector;
	                if (feature.type == 'Polygon' || feature.type == 'MultiPolygon') {
	                    type = 'way';
	                    selector = 'area';
	                } else if (feature.type == 'LineString' || feature.type == 'MultiLineString') {
	                    type = 'way';
	                    selector = 'line';
	                } else if (feature.type == 'Point' || feature.type == 'MultiPoint') {
	                    type = 'node';
	                    selector = 'node';
	                }
					style = styleCache[styleKey] = MapCSS.restyle(feature.properties, zoom, type, selector);
				}
				
				for (j in style) {
					if (style.hasOwnProperty(j)) {
						restyledFeature = extend({}, feature);
						restyledFeature.style = style[j];
						styledFeatures.push(restyledFeature);
					}
				}
			}
			
			styledFeatures.sort(function (a, b) {
				return parseFloat(a.style["z-index"] || 0) - parseFloat(b.style["z-index"] || 0);
			});
			
			return styledFeatures;
		}
		
		function populateLayers(data, zoom) {
			var styledFeatures = styleFeatures(data.features, zoom);
			
			for (var i = 0, len = styledFeatures.length; i < len; i++) {
				var feature = styledFeatures[i],
					layerId = parseFloat(feature.properties.layer) || 0,
					layerStyle = feature.style["-x-mapnik-layer"];
					
				if (layerStyle == "top" ) { 
					layerId = 10000;
				}
				if (layerStyle == "bottom" ) {
					layerId = -10000;
				}
				if (!(layerId in layers)) {
					layers[layerId] = [];
					layerIds.push(layerId);
				}
				layers[layerId].push(feature);
			}
			
			layerIds.sort();
		}
		
		function setStyles(styles) {
			for (var i in styles) {
				if (styles.hasOwnProperty(i) && styles[i]) {
					ctx[i] = styles[i];
				}
			}
		}
		
		function pathGeoJSON(feature, dashes, fill) {
			var type = feature.type;
			var coords = feature.coordinates;
			if (!pathOpened) {
				pathOpened = true;
				ctx.beginPath();
			}
			
			var i, j, k, len, pointsLen, points, prevPoint, firstPoint, point;
			
			function isTileBoundary(p) {
				var v = prevPoint,
					g = granularity;
				
				return ((v[0] == 0 || v[0] == g || v[1] == 0 || v[1] == g) &&
						(p[0] == 0 || p[0] == g || p[1] == 0 || p[1] == g));
			}
			if (type == "Polygon"){
				coords = [coords];
				type = "MultiPolygon";
			}

			
			if (type == "MultiPolygon" ) {
				for (i = 0, len = coords.length; i < len; i++) {
					for (k = 0, leng = coords[i].length; k < leng; k++) {
						points = coords[i][k];
						pointsLen = points.length;
						prevPoint = points[0];

						if (dashes) {
							setDashPattern(prevPoint, dashes);
						}

						moveTo(prevPoint);
						if (fill) {
							for (j = 1; j < pointsLen; j++) {
								lineTo(points[j]);
							}
						} else {
							for (j = 1; j < pointsLen; j++) {
								point = points[j];
								if (isTileBoundary(point)) { //hide boundaries
									moveTo(point);
									setDashPattern(point, dashes);
								} else if (dashes) {
									dashTo(point);
								} else {
									lineTo(point);
								}
								prevPoint = point;
							}
						}
						lineTo(points[0]);
					}
				}
			}
			if (type == "LineString"){
				coords = [coords];
				type = "MultiLineString";
			}
			if (type == "MultiLineString") {
				for (j = 0, leng = coords.length; j < leng; j++) {
					point = coords[j][0];
					if (point[0] == 0 || point[0] == granularity || point[1] == 0 || point[1] == granularity) {
						var p2 = coords[j][1];
						point = [point[0]-5*(p2[0]-point[0]), point[1]-5*(p2[1]-point[1])];
					}
					if (dashes) {
						setDashPattern(point, dashes);
					}
					moveTo(point);

					for (i = 1, len = coords[j].length; i < len; i++) {
					
						point = coords[j][i];
						if (dashes) {
							dashTo(point);
						} else {
							lineTo(point);
						}
					}
					if (point[0] == 0 || point[0] == granularity || point[1] == 0 || point[1] == granularity) {
						var p2 = coords[j][coords[j].length-2];
						point = [point[0]-5*(p2[0]-point[0]), point[1]-5*(p2[1]-point[1])];
						if (dashes) {
							dashTo(point);
						} else {
							lineTo(point);
						}

					}
					
				}
			}
		}
		
		function textOnGeoJSON(feature, halo, text) {
			if (feature.type != "LineString") return;
				
			var i, j, letter, 
				letterWidths = {},
				points = [],
				len = feature.coordinates.length,
				textWidth = 0,
				textLen = text.length,
				numIter = 0;
			
			for (i = 0; i < len; i++) {
				points.push(transformPoint(feature.coordinates[i]));
			}
			
			for (i = 0; i < textLen; i++) {
				letter = text.charAt(i);
				if (!letterWidths[letter]) {
					letterWidths[letter] = ctx.measureText(letter).width;
				}
				textWidth += letterWidths[letter];
			}
			var aspect = textWidth / ctx.measureText(text).width;
			
			//points = ST_Simplify(points, 1);
			var linelength = ST_Length(points);
			
			if (linelength < textWidth) return;
			
			var widthUsed,
				prevAngle,
				positions,
				solution = 0,
				flipCount,
				flipped = false,
				axy,
				letterWidth;
				
			while (solution < 2) {
				if (numIter > 5) return;
				numIter++;
				
				widthUsed = solution ? 2*letterWidths[text.charAt(0)] : linelength - textWidth / 2;
				flipCount = 0;
				prevAngle = null;
				positions = [];
				
				for (i = 0; i < textLen; i++) {
					letter = text.charAt(i);
					
					letterWidth = letterWidths[letter] / aspect;
					axy = ST_AngleAndCoordsAtLength(points, widthUsed);
					
					if (widthUsed >= linelength || !axy) {
						//alert("cannot fit text: "+text+" widthused:"+ widthused +" width:"+textWidth+" space:"+linelength+" letter:"+letter+" aspect:"+aspect);
						solution++;
						positions = [];
						if (flipped) {
							points.reverse();
							flipped = false;
						}
						break;
					} // cannot fit
					
					if (!prevAngle) prevAngle = axy[0];
					
					if (collides.checkPointWH([axy[1], axy[2]], 2.5 * letterWidth, 2.5 * letterWidth) || 
							Math.abs(prevAngle - axy[0]) > 0.2) {
						widthUsed += letterWidth;
						i = -1;
						positions = [];
						flipCount = 0;
						continue;
					}
					
					/*while (letterwidth > axy[3] && i<text.length){
					  i++;
					  letter += text.substr(i,1);
					  letterwidth = ctx.measureText(letter).width;
					  if (
					    collides.checkPointWH([axy[1]+0.5*Math.cos(axy[3])*letterwidth,
					                         axy[2]+0.5*Math.sin(axy[3])*letterwidth],
					                         2.5*letterwidth,
					                         2.5*letterwidth)
					    || Math.abs(prevangle-axy[0])>0.2){
					    i = 0;
					    positions = new Array();
					    letter = text.substr(i,1);
					    break;
					  }

					}*/
					if ((axy[0] > Math.PI / 2) || (axy[0] < -Math.PI / 2)) {
						flipCount += 1; //letter.length;
					}
					
					prevAngle = axy[0];
					axy.push(letter);
					positions.push(axy);
					widthUsed += letterWidth;
				}
				if (flipCount > textLen / 2) {
					points.reverse();
					positions = [];
					
					if (flipped) {
						solution++;
						flipped = false;
					} else {
						flipped = true;
					}
				}
				if (solution >= 2) return;
				if (positions.length > 0) break;
				flipCount = 0;
			}
			
			var posLen = positions.length;
			
			for (i = 0; halo && (i < posLen); i++) {
				axy = positions[i];
				letter = axy[4];
				
				ctx.save();
				
				ctx.translate(axy[1], axy[2]);
				ctx.rotate(axy[0]);
				
				ctx.strokeText(letter, 0, 0);
				ctx.restore();
			}
			
			for (i = 0; i < posLen; i++) {
				axy = positions[i];
				letter = axy[4];
				letterWidth = letterWidths[letter];
				
				ctx.save();
				
				ctx.translate(Math.floor(axy[1]), Math.floor(axy[2]));
				ctx.rotate(axy[0]);
				
				collides.addPointWH([
					axy[1] + 0.5 * Math.cos(axy[3]) * letterWidth,
					axy[2] + 0.5 * Math.sin(axy[3]) * letterWidth ],
						2.5 * letterWidth, 2.5 * letterWidth);
				//collides.addPointWH([axy[1],axy[2]],2.5*letterwidth+20,2.5*letterwidth+20);
				
				ctx.fillText(letter, 0, 0);
				ctx.restore();
			}
		}
		
		function transformPoint(point) {
			return [ws * point[0], hs * (granularity - point[1])];
		}
		
		function moveTo(point) {
			var p2 = transformPoint(point);
			ctx.moveTo(p2[0], p2[1]);
		}
		
		function lineTo(point) {
			var p2 = transformPoint(point);
			ctx.lineTo(p2[0], p2[1]);
		}
		
		function setDashPattern(point, dashes) {
			var p2 = transformPoint(point);
			
			dashPattern = {
				pattern: dashes,
				seg: 0,
				phs: 0,
				x: p2[0],
				y: p2[1]
			};
		}
		
		function dashTo(point) {
			var p = transformPoint(point);
			
			var pt = dashPattern,
				dx = p[0] - pt.x, 
				dy = p[1] - pt.y, 
				dist = Math.sqrt(dx * dx + dy * dy), 
				x, more, t;

			ctx.save();
			ctx.translate(pt.x, pt.y);
			ctx.rotate(Math.atan2(dy, dx));
			ctx.moveTo(0, 0);
			
			x = 0;
			do {
				t = pt.pattern[pt.seg];
				x += t - pt.phs;
				more = x < dist;
				
				if (!more) {
					pt.phs = t - (x - dist);
					x = dist;
				}
				
				pt.seg % 2 ? ctx.moveTo(x, 0) : ctx.lineTo(x, 0);
				
				if (more) {
					pt.phs = 0;
					pt.seg = ++pt.seg % pt.pattern.length;
				}
			} while (more);
			
			pt.x = p[0];
			pt.y = p[1];
			ctx.restore();
		}

		function fontString(name, size) {
			if (!name) {
				return size + 'px Arial, Helvetica, sans-serif';
			}
			
			var family = name || '';
				
			size = size || 9;
			name = name.toLowerCase();
			
			var style = (name.indexOf("italic") != -1 || name.indexOf("oblique") != -1 ? 'italic' : 'normal'),
				weight = (name.indexOf("bold") != -1 ? 'bold' : 'normal'); 
			
			if (name.indexOf('serif') != -1) {
				family += ', Georgia, serif';
			} else {
				family += (family ? ', ' : '') + 'Arial, Helvetica, sans-serif';
			}
			
			return weight + " " + style + " " + size +"px " + family;
		}
		
		function extend(dest, source) {
			for (var i in source) {
				if (source.hasOwnProperty(i)) {
					dest[i] = source[i];
				}
			}
			return dest;
		}
	}

	function emptyFn() {}

	function CollisionBuffer() {
		this.buffer = [];
	}
	
	CollisionBuffer.prototype = {
		addBox: function(box) {
			this.buffer.push(box);
		},
		
		addPointWH: function(point, w, h, d) {
			if (!d)d=0;
			this.buffer.push([point[0]-w/2-d, point[1]-h/2-d, point[0]+w/2-d, point[1]+w/2-d]);
		},
		
		checkBox: function(b) {
			for (var i = 0, len = this.buffer.length, c; i < len; i++) {
				c = this.buffer[i];
				if ((c[0]<=b[2] && c[1]<=b[3] && c[2]>=b[0] && c[3]>=b[1])) return true;
			}
			return false;
		},
		
		checkPointWH: function(point, w, h) {
			return this.checkBox([point[0]-w/2, point[1]-h/2, point[0]+w/2, point[1]+w/2]);
		}
	};
	
	return {
		render: render,
		onRenderComplete: emptyFn
	};
})();
