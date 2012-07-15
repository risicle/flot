/*
Flot plugin for showing "eyes on sticks" highlight visualization for tsbp
*/

(function ($) {
    var options = {
        series: {
            eoshighlight: false , // or "active" or "passive" - whether line's points exhibit eoshighlight behaviour
            eoshighlightRangeFillColor: "rgba(0,0,0,0.2)" ,
            eoshighlightNullMarkingColor: "rgba(0,0,0,0.2)"
        }
    };

    function init(plot) {
        var eosselectedseries;
        var eosselectedindexes = [];
        // the "pending" point is the one that a drag is starting from. visually it overrides
        // the selected one, but the selected one should remain the one actually selected until
        // the dragging has finished.
        var eospendingseries;
        var eospendingindex;
        var eospendingxpos;
        var eoshoveredseries;
        var eoshoveredindex;
        var placeholder = plot.getPlaceholder ();

        function checkInSelectionArea ( x_c , y_c ) {
            if ( eosselectedindexes.length <= 1 )
                return false;

            var i, x_p = eosselectedseries.xaxis.c2p(x_c);

            if (x_p < eosselectedseries.datapoints.points[eosselectedindexes[0]*eosselectedseries.datapoints.pointsize] ||
                x_p >= eosselectedseries.datapoints.points[eosselectedindexes[1]*eosselectedseries.datapoints.pointsize] )
                // not in x range of selection
                return false;

            for (i = eosselectedindexes[0]; x_p > eosselectedseries.datapoints.points[i*eosselectedseries.datapoints.pointsize]; i++) {
                // just keep iterating till we're just past x_p
            }

            // a and b are the points to the left & right of the cursor respectively
            var x_c_a = eosselectedseries.xaxis.p2c(eosselectedseries.datapoints.points[(i-1)*eosselectedseries.datapoints.pointsize]);
            var x_c_b = eosselectedseries.xaxis.p2c(eosselectedseries.datapoints.points[i*eosselectedseries.datapoints.pointsize]);
            var y_p_a = eosselectedseries.datapoints.points[((i-1)*eosselectedseries.datapoints.pointsize)+1];
            var y_p_b = eosselectedseries.datapoints.points[(i*eosselectedseries.datapoints.pointsize)+1];
            var y_c_a = y_p_a == null ? plot.height()/2 : eosselectedseries.yaxis.p2c(y_p_a);
            var y_c_b = y_p_b == null ? plot.height()/2 : eosselectedseries.yaxis.p2c(y_p_b);

            if ( y_c < (y_c_b*(x_c-x_c_a)/(x_c_b-x_c_a)) + (y_c_a*(x_c_b-x_c)/(x_c_b-x_c_a)) )
                return false;

            return true;
        }

        // ripped and adapted from jquery.flot.js's findNearbyItem ()
        function findNearbyNullItem ( mouseX , mouseY, seriesFilter ) {
            var series = plot.getData (), options = plot.getOptions ();
            var maxDistance = options.grid.mouseActiveRadius,
                smallestDistance = maxDistance * maxDistance + 1,
                item = null, foundPoint = false, i, j;

            // little shortcut here - if mouse isn't in the band where the null
            // points lie, don't even bother looking.
            if (Math.abs(mouseY - (plot.height()/2)) > maxDistance)
                return null;

            for (i = series.length - 1; i >= 0; --i) {
                var s = series[i],
                    axisx = s.xaxis,
                    axisy = s.yaxis,
                    points = s.datapoints.points,
                    ps = s.datapoints.pointsize,
                    mx = axisx.c2p(mouseX), // precompute some stuff to make the loop faster
                    my = axisy.c2p(mouseY),
                    maxx = maxDistance / axisx.scale,
                    maxy = maxDistance / axisy.scale;

                if (!seriesFilter(s))
                    continue

                for (j = 0; j < points.length; j += ps) {
                    var x = points[j], y = points[j + 1];
                    if (y != null)
                        continue;

                    // For points and lines, the cursor must be within a
                    // certain distance to the data point
                    if (x - mx > maxx || x - mx < -maxx)
                        continue;

                    // We have to calculate distances in pixels, not in
                    // data units, because the scales of the axes may be different
                    var dx = Math.abs(axisx.p2c(x) - mouseX),
                        dy = plot.height()/2 - mouseY,
                        dist = dx * dx + dy * dy; // we save the sqrt

                    // use <= to ensure last point takes precedence
                    // (last generally means on top of)
                    if (dist < smallestDistance) {
                        smallestDistance = dist;
                        item = [i, j / ps];
                    }
                }
            }

            if (item) {
                i = item[0];
                j = item[1];
                ps = series[i].datapoints.pointsize;

                return { datapoint: series[i].datapoints.points.slice(j * ps, (j + 1) * ps),
                         dataIndex: j,
                         series: series[i],
                         seriesIndex: i };
            }

            return null;
        }

        function onPlotHover (event , pos, item) {
            var ca_bbox = getContextArrowBBox (),
                offset = plot.getPlotOffset(),
                placeholder = plot.getPlaceholder(),
                placeholder_offset = placeholder.offset ();

            var offset_x = pos.pageX - ( offset.left + placeholder_offset.left );
            var offset_y = pos.pageY - ( offset.top + placeholder_offset.top );

            if (item == null)
                // check if we're over a null item
                item = findNearbyNullItem ( offset_x , offset_y , function ( series ) { return series["eoshighlight"] && series["hoverable"] !== false } );

            if (ca_bbox != null && offset_x >= ca_bbox.x0 && offset_x < ca_bbox.x1 && offset_y >= ca_bbox.y0 && offset_y < ca_bbox.y1) {
                plot.eosHover ();
                placeholder.css("cursor", "pointer");
            }
            else if (item != null) {
                plot.eosHover (item.series, item.dataIndex);
                if (item.series === eosselectedseries && eosselectedindexes.length === 1 && item.dataIndex === eosselectedindexes[0])
                    placeholder.css("cursor", "pointer");
                else
                    placeholder.css("cursor", "default");
            }
            else {
                if (checkInSelectionArea(offset_x, offset_y)) {
                    placeholder.css("cursor", "pointer");
                }
                else {
                    placeholder.css("cursor", "default");
                }
                plot.eosHover ();
            }
        }

        function onPlotClick (event , pos, item) {
            var ca_bbox = getContextArrowBBox (),
                offset = plot.getPlotOffset(),
                placeholder = plot.getPlaceholder(),
                placeholder_offset = placeholder.offset ();

            var offset_x = pos.pageX - ( offset.left + placeholder_offset.left );
            var offset_y = pos.pageY - ( offset.top + placeholder_offset.top );

            if (item == null)
                // check if we're over a null item
                item = findNearbyNullItem ( offset_x , offset_y , function ( series ) { return series["eoshighlight"] && series["clickable"] !== false } );

            if (ca_bbox != null && offset_x >= ca_bbox.x0 && offset_x < ca_bbox.x1 && offset_y >= ca_bbox.y0 && offset_y < ca_bbox.y1) {
                // open a context menu
                return false;
            }
            else if (item != null) {
                if (item.series === eosselectedseries && eosselectedindexes.length === 1 && item.dataIndex === eosselectedindexes[0]) {
                    // open a context menu
                    return false;
                }
                else {
                    plot.eosSelect (item.series, item.dataIndex);
                }
            }
            else {
                if (checkInSelectionArea(offset_x, offset_y)) {
                    // open a context menu
                    return false;
                }
                else {
                    plot.eosSelect ();
                }
            }
        }

        function onContextMenu(event) {
            var ca_bbox = getContextArrowBBox (),
                offset = plot.getPlotOffset(),
                placeholder = plot.getPlaceholder(),
                placeholder_offset = placeholder.offset ();

            var offset_x = event.pageX - ( offset.left + placeholder_offset.left );
            var offset_y = event.pageY - ( offset.top + placeholder_offset.top );

            var sf = function ( series ) { return series["eoshighlight"] && series["clickable"] !== false };

            var item = plot.findNearbyItem (offset_x, offset_y, sf) || findNearbyNullItem (offset_x, offset_y, sf);

            if (ca_bbox != null && offset_x >= ca_bbox.x0 && offset_x < ca_bbox.x1 && offset_y >= ca_bbox.y0 && offset_y < ca_bbox.y1) {
                // open a context menu
                return false;
            }
            else if (item != null) {
                plot.eosSelect (item.series, item.dataIndex);
                // open a context menu
                return false;
            }
        }

        function onDragStart(event, dragdrop) {
            var offset = plot.getPlotOffset(),
                placeholder = plot.getPlaceholder(),
                placeholder_offset = placeholder.offset ();

            var offset_start_x = dragdrop.startX - ( offset.left + placeholder_offset.left );
            var offset_start_y = dragdrop.startY - ( offset.top + placeholder_offset.top );

            var sf = function ( series ) { return series["eoshighlight"] && series["clickable"] !== false };

            // lets see if the drag started on a point
            var item = plot.findNearbyItem (offset_start_x, offset_start_y, sf) || findNearbyNullItem (offset_start_x, offset_start_y, sf);
            if (item == null)
                return false;

            eospendingseries = item.series;
            eospendingindex = item.dataIndex;
            eospendingxpos = eospendingseries.xaxis.c2p ( offset_start_x + dragdrop.deltaX );

            plot.triggerRedrawOverlay();
        }

        function onDrag(event, dragdrop) {
            if (!eospendingseries)
                return;

            var offset = plot.getPlotOffset(),
                placeholder = plot.getPlaceholder(),
                placeholder_offset = placeholder.offset ();

            var offset_start_x = dragdrop.startX - ( offset.left + placeholder_offset.left );

            // just update this really
            eospendingxpos = eospendingseries.xaxis.c2p ( offset_start_x + dragdrop.deltaX );

            plot.triggerRedrawOverlay();
        }

        function onDragEnd(event, dragdrop) {
            if (eospendingindex == null)
                return;

            var offset = plot.getPlotOffset(),
                placeholder = plot.getPlaceholder(),
                placeholder_offset = placeholder.offset (),
                i, xval;

            // first let's check if we're over another point
            var offset_x = dragdrop.startX + dragdrop.deltaX - ( offset.left + placeholder_offset.left );
            var offset_y = dragdrop.startY + dragdrop.deltaY - ( offset.top + placeholder_offset.top );

            var sf = function ( series ) { return series === eospendingseries };

            var item = plot.findNearbyItem (offset_x, offset_y, sf) || findNearbyNullItem (offset_x, offset_y, sf);
            if (item != null) {
                // yup. let's use that.
                plot.eosSelect ( eospendingseries , Math.min(eospendingindex,item.dataIndex) , Math.max(eospendingindex,item.dataIndex) );
            }
            else {
                // nope. will try to find nearest in x direction. assuming monotonic
                // x values here of course
                xval = eospendingseries.xaxis.c2p(offset_x);
                for ( i = 0 ; i < eospendingseries.data.length ; i++ ) {
                    if ( eospendingseries.datapoints.points[i*eospendingseries.datapoints.pointsize] > xval )
                        break;
                }
                // non-"backwards" selections should actually catch the point _before_ we went past the x value
                if (dragdrop.deltaX > 0)
                    i--;
                plot.eosSelect ( eospendingseries , Math.min(eospendingindex,i) , Math.max(eospendingindex,i) );
            }

            // now clear these
            eospendingseries = null;
            eospendingindex = null;
            eospendingxpos = null;

            plot.triggerRedrawOverlay();
        }

        function getContextArrowBBox () {
            if (!eosselectedindexes.length)
                // there ain't one
                return null;

            var point, bbox, x_midpoint, x_sum = 0, y_coord, outer_radius = eosselectedseries.points.radius + eosselectedseries.points.lineWidth*0.5;
            for (var i = 0; i < eosselectedindexes.length; i++) {
                point = eosselectedseries.datapoints.points.slice(eosselectedindexes[i] * eosselectedseries.datapoints.pointsize, (eosselectedindexes[i]+1) * eosselectedseries.datapoints.pointsize)
                x_sum += eosselectedseries.xaxis.p2c(point[0]);
            }
            x_midpoint = x_sum / eosselectedindexes.length;

            bbox = { x0: x_midpoint - eosselectedseries.points.radius, x1: x_midpoint + eosselectedseries.points.radius };

            if (bbox.x1 < 0 || bbox.x0 > plot.width())
                // off the side
                return null;

            if (eosselectedindexes.length > 1) {
                bbox.y0 = outer_radius;
                bbox.y1 = outer_radius*2;
            }
            else {
                // point should still be the last (& only) point
                y_coord = point[1] == null ? plot.height()/2 : eosselectedseries.yaxis.p2c(point[1]);
                if (y_coord >= 3*outer_radius) {
                    // there's enough space to show an arrow normally
                    bbox.y0 = y_coord - 3*outer_radius;
                    bbox.y1 = y_coord - 2*outer_radius;
                }
                else if (y_coord >= 2*outer_radius) {
                    // there's enough space to show an arrow stuck to the top
                    bbox.y0 = 0;
                    bbox.y1 = outer_radius;
                }
                else if (y_coord >= outer_radius) {
                    // there's not really enough space - stick it to the top
                    // of the selected indicator and let it disappear off the top
                    bbox.y0 = y_coord - 2*outer_radius;
                    bbox.y1 = y_coord - outer_radius;
                }
                else
                    return null;
            }

            return bbox;
        }

        plot.eosSelect = function (s, pointindex_from, pointindex_to) {
            var series = plot.getData ();
            if (typeof s == "number")
                s = series[s];

            if (s && !s.eoshighlight)
                // eoshighlight isn't supposed to be enabled for this series
                return;

            if (eosselectedseries === s &&
                pointindex_from == eosselectedindexes[0] &&
                pointindex_to == eosselectedindexes[1])
                // nothing to do
                return;

            if (pointindex_from === pointindex_to)
                // this isn't how we notate this
                pointindex_to = null;

            eosselectedseries = s;
            eosselectedindexes = [];
            if (pointindex_from != null) {
                eosselectedindexes.push(pointindex_from);
                if (pointindex_to != null) {
                    eosselectedindexes.push(pointindex_to);
                }
            }
            placeholder.trigger ( "ploteosselected" , [ eosselectedseries == null ? null : $.inArray ( eosselectedseries , series ) , eosselectedindexes ] );
            plot.triggerRedrawOverlay();
        }

        plot.eosHover = function (s, pointindex) {
            var series = plot.getData ();
            if (typeof s == "number")
                s = series[s];

            if (s && !s.eoshighlight)
                // eoshighlight isn't supposed to be enabled for this series
                return;

            if (eoshoveredseries === s && pointindex == eoshoveredindex)
                // nothing to do
                return;

            eoshoveredindex = pointindex;
            eoshoveredseries = s;

            placeholder.trigger ( "ploteoshovered" , [ eoshoveredseries == null ? null : $.inArray ( eoshoveredseries , series ) , eoshoveredindex ] );
            plot.triggerRedrawOverlay();
        }

        plot.hooks.processRawData.push(function (plot, series, data, datapoints) {
            if (!series.eoshighlight)
                return;

            datapoints.format = [
                { x: true, number: true, required: true },
                { y: true, number: true, required: false }
            ];

        });

        plot.hooks.processDatapoints.push(function (plot, series, datapoints) {
            if (!series.eoshighlight)
                return;

            // all we're really going to do here is add markings entries corresponding
            // to blocks of nulls
            var o = plot.getOptions();
            var markings = o.grid.markings || [];
            var i;
            var last_non_null = -1;
            for (i = 0; i < datapoints.points.length/datapoints.pointsize; i++) {
                if (datapoints.points[i*datapoints.pointsize+1] != null) {
                    if (last_non_null != i-1)
                        markings.push({ xaxis: { from: datapoints.points[last_non_null*datapoints.pointsize] == null ? null : datapoints.points[last_non_null*datapoints.pointsize] + 0.5 , to: datapoints.points[i*datapoints.pointsize] == null ? null : datapoints.points[i*datapoints.pointsize] - 0.5 } , color: series.eoshighlightNullMarkingColor });
                    last_non_null = i;
                }
            }
            if (i != 0 && last_non_null != i-1)
                // any trailing markings by now will have no right bound, thus null
                markings.push({ xaxis: { from: datapoints.points[last_non_null*datapoints.pointsize] == null ? null : datapoints.points[last_non_null*datapoints.pointsize] + 0.5 , to: null } , color: series.eoshighlightNullMarkingColor });

            // make sure this is assigned
            o.grid.markings = markings;
        });

        function emitNullBypassLine ( ctx , series , i , last_non_null ) {
            var x1 = series.datapoints.points[last_non_null*series.datapoints.pointsize];
            var x2 = series.datapoints.points[i*series.datapoints.pointsize];
            var y1 = series.datapoints.points[(last_non_null*series.datapoints.pointsize)+1];
            var y2 = series.datapoints.points[(i*series.datapoints.pointsize)+1];

            if ( x1 == null || x2 == null || y1 == null || y2 == null )
                // there is no right or left point to bypass to or it is null
                return;

            if ( x2 < series.xaxis.min || x1 > series.xaxis.max)
                // off plot area
                return;

            ctx.moveTo ( series.xaxis.p2c(x1) , series.yaxis.p2c(y1) );
            ctx.lineTo ( series.xaxis.p2c(x2) , series.yaxis.p2c(y2) );
        }

        plot.hooks.drawSeries.push(function (plot, ctx, series) {
            if (!series.eoshighlight)
                return;

            var i, x;
            var last_non_null = -1;
            var plotOffset = plot.getPlotOffset ();

            //
            // Draw lines bypassing blocks of nulls
            //
            ctx.save ();

                ctx.translate ( plotOffset.left , plotOffset.top );

                // unlike flot proper, I'm not really worried about IE8/excanvas users - I don't
                // think half the things I'm going to do will work in IE8 anyway. So rather than
                // doing complex line clipping stuff I'm just going to use a clipping path and be
                // done with it.
                ctx.beginPath ()
                ctx.rect ( 0 , 0 , plot.width () , plot.height () );
                ctx.clip ();

                // grab desired painting settings
                ctx.lineCap = "round";
                ctx.lineWidth = series.lines.lineWidth;
                ctx.strokeStyle = series.color;

                if ($.isFunction(series.lines.setupDrawContext))
                    series.lines.setupDrawContext(plot, series, ctx);

                // we want this to be semitransparent
                ctx.globalAlpha = 0.5;

                ctx.beginPath ();
                for (i = 0; i < series.datapoints.points.length/series.datapoints.pointsize; i++) {
                    if (series.datapoints.points[i*series.datapoints.pointsize+1] != null) {
                        if (last_non_null != i-1)
                            emitNullBypassLine ( ctx , series , i , last_non_null );
                        last_non_null = i;
                    }
                }

                ctx.stroke ();

            ctx.restore ();

            //
            // Draw points in place of nulls
            //
            ctx.save ();

                ctx.translate ( plotOffset.left , plotOffset.top );
                ctx.fillStyle = series.color
                ctx.globalAlpha = 0.5;

                var nullpointsize = Math.min ( series.points.radius , Math.abs ( series.xaxis.p2c ( 0 ) - series.xaxis.p2c ( 1 ) ) ) * 0.8;
                if (nullpointsize >= 1) { // (else don't bother)
                    for (i = 0; i < series.datapoints.points.length/series.datapoints.pointsize; i++) {
                        if (series.datapoints.points[i*series.datapoints.pointsize+1] == null) {
                            if (series.datapoints.points[i*series.datapoints.pointsize] < series.min ||
                                series.datapoints.points[i*series.datapoints.pointsize] > series.max)
                                // off plot area
                                continue;

                            ctx.beginPath ();
                                    ctx.arc(series.xaxis.p2c(series.datapoints.points[i*series.datapoints.pointsize]), ( plot.height () / 2 ), nullpointsize, 0, 2 * Math.PI, false);
                            ctx.fill ();
                        }
                    }
                }
            ctx.restore ();
        });

        plot.hooks.bindEvents.push(function (plot, eventHolder) {
            var enabled = false;
            var series = plot.getData ();
            var s;
            for (var i = 0; i < series.length; i++) {
                s = series[i];
                // only need to add event handlers if "active"
                if (s.eoshighlight === "active") {
                    enabled = true;
                    break;
                }
            }
            if (!enabled)
                return;

            placeholder.on("plothover", onPlotHover);
            placeholder.on("plotclick", onPlotClick);
            eventHolder.on("contextmenu", onContextMenu);

            eventHolder.on("dragstart", { distance: 4 , click: false }, onDragStart);
            eventHolder.on("drag", { distance: 4 , click: false }, onDrag);
            eventHolder.on("dragend", { distance: 4 , click: false }, onDragEnd);
        });

        plot.hooks.drawOverlay.push(function (plot, ctx) {
            if (eoshoveredindex == null && eospendingindex == null && !eosselectedindexes.length)
                // nothing to draw
                return;

            var plotOffset = plot.getPlotOffset();
            var point, point_x, point_y, xaxis, yaxis, radius;
            var x, y, xa, xb, i;
            var ca_bbox = getContextArrowBBox ();

            ctx.save();
            ctx.translate(plotOffset.left, plotOffset.top);

            if (eospendingindex != null) {
                x0 = eospendingseries.xaxis.p2c(eospendingseries.datapoints.points[eospendingindex*eospendingseries.datapoints.pointsize]);
                x1 = eospendingseries.xaxis.p2c(eospendingxpos);
                ctx.fillStyle = eospendingseries.eoshighlightRangeFillColor;

                ctx.fillRect ( Math.min(x0,x1) , 0 , Math.abs(x0 - x1) , plot.height () );

                radius = eospendingseries.points.radius;
                ctx.lineWidth = eospendingseries.points.lineWidth;
                ctx.strokeStyle = $.color.parse(eospendingseries.color).toString();

                point = eospendingseries.datapoints.points.slice(eospendingindex * eospendingseries.datapoints.pointsize, (eospendingindex+1) * eospendingseries.datapoints.pointsize);
                x = eospendingseries.xaxis.p2c(point[0]);
                y = point[1] == null ? plot.height()/2 : eospendingseries.yaxis.p2c(point[1]);

                ctx.beginPath();
                    ctx.arc(x, y, radius, 0.5 * Math.PI, 2.5 * Math.PI, false);
                    if ( eospendingseries.eoshighlight === "active" )
                        ctx.lineTo(x, plot.height());
                ctx.closePath();

                ctx.stroke();
            }
            else if (eosselectedindexes.length) {
                xaxis = eosselectedseries.xaxis;
                yaxis = eosselectedseries.yaxis;

                if (eosselectedindexes.length > 1) {
                    // draw filled area of selected range
                    ctx.save();
                        // use of clip() isn't compatible with excanvas, but i doubt what im doing
                        // elsewhere works in old IEs at all.
                        if ($.isFunction(ctx.clip)) {
                            ctx.beginPath();
                                ctx.rect(0, 0, plot.width(), plot.height());
                            ctx.clip();
                        }

                        ctx.fillStyle = eosselectedseries.eoshighlightRangeFillColor;
                        ctx.beginPath ();
                            ctx.moveTo( xaxis.p2c(eosselectedseries.datapoints.points[eosselectedindexes[0]*eosselectedseries.datapoints.pointsize]) , plot.height () );
                            for (i = eosselectedindexes[0]; i <= eosselectedindexes[1]; i++) {
                                x = eosselectedseries.datapoints.points[i*eosselectedseries.datapoints.pointsize];
                                y = eosselectedseries.datapoints.points[(i*eosselectedseries.datapoints.pointsize)+1];

                                // note shift down by half line width in naive attempt to not overlap the line too much.
                                ctx.lineTo( xaxis.p2c(x) , y == null ? plot.height() / 2 : yaxis.p2c(y) + eosselectedseries.lines.lineWidth*0.5 );
                            }
                            ctx.lineTo( xaxis.p2c(eosselectedseries.datapoints.points[eosselectedindexes[1]*eosselectedseries.datapoints.pointsize]) , plot.height () );
                        ctx.fill();
                    ctx.restore();
                }

                radius = eosselectedseries.points.radius;
                ctx.lineWidth = eosselectedseries.points.lineWidth;
                ctx.strokeStyle = $.color.parse(eosselectedseries.color).toString();

                xaxis = eosselectedseries.xaxis;
                yaxis = eosselectedseries.yaxis;

                // draw eyes on sticks
                for (i = 0; i < eosselectedindexes.length; i++) {
                    point = eosselectedseries.datapoints.points.slice(eosselectedindexes[i] * eosselectedseries.datapoints.pointsize, (eosselectedindexes[i]+1) * eosselectedseries.datapoints.pointsize);
                    if ( point[0] < xaxis.min || point[0] > xaxis.max || point[1] < yaxis.min || point[1] > yaxis.max )
                        continue;

                    x = xaxis.p2c(point[0]);
                    y = point[1] == null ? plot.height()/2 : yaxis.p2c(point[1]);

                    ctx.beginPath();
                        ctx.arc(x, y, radius, 0.5 * Math.PI, 2.5 * Math.PI, false);
                        if ( eosselectedseries.eoshighlight === "active" )
                        	ctx.lineTo(x, plot.height());
                    ctx.closePath();

                    ctx.stroke();
                }

                // draw context arrow
                if (eosselectedseries.eoshighlight === "active" && ca_bbox != null) {
                    ctx.fillStyle = $.color.parse(eosselectedseries.color).toString();
                    ctx.beginPath();
                        ctx.moveTo(ca_bbox.x0, ca_bbox.y1);
                        ctx.lineTo((ca_bbox.x0 + ca_bbox.x1)*0.5, ca_bbox.y0);
                        ctx.lineTo(ca_bbox.x1, ca_bbox.y1);
                        ctx.lineTo(ca_bbox.x0, ca_bbox.y1);
                    ctx.closePath();

                    ctx.fill();
                }
            }

            if (eoshoveredindex != null) {
                radius = eoshoveredseries.points.radius;
                ctx.lineWidth = eoshoveredseries.points.lineWidth;
                ctx.strokeStyle = $.color.parse(eoshoveredseries.color).toString();
                ctx.fillStyle = $.color.parse(eoshoveredseries.color).toString();

                xaxis = eoshoveredseries.xaxis;
                yaxis = eoshoveredseries.yaxis;

                point = eoshoveredseries.datapoints.points.slice(eoshoveredindex * eoshoveredseries.datapoints.pointsize, (eoshoveredindex+1) * eoshoveredseries.datapoints.pointsize);
                if ( !(point[0] < xaxis.min || point[0] > xaxis.max || point[1] < yaxis.min || point[1] > yaxis.max ) ) {
                    x = xaxis.p2c(point[0]);
                    y = point[1] == null ? plot.height()/2 : yaxis.p2c(point[1]);

                    ctx.beginPath();
                        ctx.arc(x, y, radius, 0.5 * Math.PI, 2.5 * Math.PI, false);
                    ctx.closePath();

                    ctx.fill();

                    if ( eoshoveredseries.eoshighlight === "active" ) {
                        ctx.beginPath();
                            ctx.moveTo(x, y);
                            ctx.lineTo(x, plot.height());
                        ctx.closePath();

                        ctx.stroke();
                    }
                }
            }

            ctx.restore();
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            placeholder.off("plothover", onPlotHover);
            placeholder.off("plotclick", onPlotClick);
            eventHolder.off("contextmenu", onContextMenu);

            eventHolder.off("dragstart", onDragStart);
            eventHolder.off("drag", onDrag);
            eventHolder.off("dragend", onDragEnd);
        });
    }
    
    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'eoshighlight',
        version: '1.0'
    });
})(jQuery);