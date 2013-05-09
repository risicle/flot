/*
Flot plugin for adding panning and zooming capabilities to a plot.

The default behaviour is double click and scrollwheel up/down to zoom
in, drag to pan. The plugin defines plot.zoom({ center }),
plot.zoomOut() and plot.pan(offset) so you easily can add custom
controls. It also fires a "plotpan" and "plotzoom" event when
something happens, useful for synchronizing plots.

Options:

  zoom: {
    interactive: false
    trigger: "dblclick" // or "click" for single click
    amount: 1.5         // 2 = 200% (zoom in), 0.5 = 50% (zoom out)
  }
  
  pan: {
    interactive: false
    cursor: "move"      // CSS mouse cursor value used when dragging, e.g. "pointer"
    frameRate: 20
  }

  xaxis, yaxis, x2axis, y2axis: {
    zoomRange: null  // or [number, number] (min range, max range) or false
    panRange: null   // or [number, number] (min, max) or false
  }
  
"interactive" enables the built-in drag/click behaviour. If you enable
interactive for pan, then you'll have a basic plot that supports
moving around; the same for zoom.

"amount" specifies the default amount to zoom in (so 1.5 = 150%)
relative to the current viewport.

"cursor" is a standard CSS mouse cursor string used for visual
feedback to the user when dragging.

"frameRate" specifies the maximum number of times per second the plot
will update itself while the user is panning around on it (set to null
to disable intermediate pans, the plot will then not update until the
mouse button is released).

"zoomRange" is the interval in which zooming can happen, e.g. with
zoomRange: [1, 100] the zoom will never scale the axis so that the
difference between min and max is smaller than 1 or larger than 100.
You can set either end to null to ignore, e.g. [1, null]. If you set
zoomRange to false, zooming on that axis will be disabled.

"panRange" confines the panning to stay within a range, e.g. with
panRange: [-10, 20] panning stops at -10 in one end and at 20 in the
other. Either can be null, e.g. [-10, null]. If you set
panRange to false, panning on that axis will be disabled.

Example API usage:

  plot = $.plot(...);
  
  // zoom default amount in on the pixel (10, 20) 
  plot.zoom({ center: { left: 10, top: 20 } });

  // zoom out again
  plot.zoomOut({ center: { left: 10, top: 20 } });

  // zoom 200% in on the pixel (10, 20) 
  plot.zoom({ amount: 2, center: { left: 10, top: 20 } });
  
  // pan 100 pixels to the left and 20 down
  plot.pan({ left: -100, top: 20 })

Here, "center" specifies where the center of the zooming should
happen. Note that this is defined in pixel space, not the space of the
data points (you can use the p2c helpers on the axes in Flot to help
you convert between these).

"amount" is the amount to zoom the viewport relative to the current
range, so 1 is 100% (i.e. no change), 1.5 is 150% (zoom in), 0.7 is
70% (zoom out). You can set the default in the options.
  
*/


// First two dependencies, jquery.event.drag.js and
// jquery.mousewheel.js, we put them inline here to save people the
// effort of downloading them.

/*
 * jquery.event.drag would normally be included here, but for the purposes
 * of tsbp is being included separately.
 */

/* jquery.mousewheel.min.js
 * Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.0.6
 * 
 * Requires: 1.2.2+
 */
(function(d){function e(a){var b=a||window.event,c=[].slice.call(arguments,1),f=0,e=0,g=0,a=d.event.fix(b);a.type="mousewheel";b.wheelDelta&&(f=b.wheelDelta/120);b.detail&&(f=-b.detail/3);g=f;void 0!==b.axis&&b.axis===b.HORIZONTAL_AXIS&&(g=0,e=-1*f);void 0!==b.wheelDeltaY&&(g=b.wheelDeltaY/120);void 0!==b.wheelDeltaX&&(e=-1*b.wheelDeltaX/120);c.unshift(a,f,e,g);return(d.event.dispatch||d.event.handle).apply(this,c)}var c=["DOMMouseScroll","mousewheel"];if(d.event.fixHooks)for(var h=c.length;h;)d.event.fixHooks[c[--h]]=d.event.mouseHooks;d.event.special.mousewheel={setup:function(){if(this.addEventListener)for(var a=c.length;a;)this.addEventListener(c[--a],e,!1);else this.onmousewheel=e},teardown:function(){if(this.removeEventListener)for(var a=c.length;a;)this.removeEventListener(c[--a],e,!1);else this.onmousewheel=null}};d.fn.extend({mousewheel:function(a){return a?this.bind("mousewheel",a):this.trigger("mousewheel")},unmousewheel:function(a){return this.unbind("mousewheel",a)}})})(jQuery);




(function ($) {
    var options = {
        xaxis: {
            zoomRange: null, // or [number, number] (min range, max range)
            panRange: null // or [number, number] (min, max)
        },
        zoom: {
            interactive: false,
            trigger: "dblclick", // or "click" for single click
            amount: 1.5 // how much to zoom relative to current position, 2 = 200% (zoom in), 0.5 = 50% (zoom out)
        },
        pan: {
            interactive: false,
            cursor: "move",
            frameRate: 20
        }
    };

    // the various ways we can sanitize a restriction problem
    var ALIGN_MIN = 1 , ALIGN_MAX = 2 , ALIGN_CENTER = 3;

    function init(plot) {
        function onZoomClick(e, zoomOut) {
            var c = plot.offset();
            c.left = e.pageX - c.left;
            c.top = e.pageY - c.top;
            if (zoomOut)
                plot.zoomOut({ center: c });
            else
                plot.zoom({ center: c });
        }

        function onMouseWheel(e, delta) {
            onZoomClick(e, delta < 0);
            return false;
        }
        
        var prevCursor = 'default', prevPageX = 0, prevPageY = 0,
            panTimeout = null;

        function onDragStart(e) {
            if (e.which != 1)  // only accept left-click
                return false;
            var c = plot.getPlaceholder().css('cursor');
            if (c)
                prevCursor = c;
            plot.getPlaceholder().css('cursor', plot.getOptions().pan.cursor);
            prevPageX = e.pageX;
            prevPageY = e.pageY;
        }
        
        function onDrag(e) {
            var frameRate = plot.getOptions().pan.frameRate;
            if (panTimeout || !frameRate)
                return;

            panTimeout = setTimeout(function () {
                plot.pan({ left: prevPageX - e.pageX,
                           top: prevPageY - e.pageY });
                prevPageX = e.pageX;
                prevPageY = e.pageY;
                                                    
                panTimeout = null;
            }, 1 / frameRate * 1000);
        }

        function onDragEnd(e) {
            if (panTimeout) {
                clearTimeout(panTimeout);
                panTimeout = null;
            }
                    
            plot.getPlaceholder().css('cursor', prevCursor);
            plot.pan({ left: prevPageX - e.pageX,
                       top: prevPageY - e.pageY });
        }

        function processOffset(plot, options)
        {
            // enforce any panning/zooming restrictions for supplied min/max on init
            $.each(plot.getAxes(), function (axisname, axis)
            {
                if (axis.min != null || axis.max != null)
                    // we only want to enforce on first init - other changes
                    // are enforced at change time
                    return;

                if (axis.used && (axis.options.zoomRange != null || axis.options.panRange != null))
                    setMinMax(axis, axis.options.min != null ? axis.options.min : axis.datamin, axis.options.max != null ? axis.options.max : axis.datamax);
            });
        }
        
        function bindEvents(plot, eventHolder) {
            var o = plot.getOptions();
            if (o.zoom.interactive) {
                eventHolder[o.zoom.trigger](onZoomClick);
                eventHolder.mousewheel(onMouseWheel);
            }

            if (o.pan.interactive) {
                eventHolder.bind("dragstart", { distance: 10 }, onDragStart);
                eventHolder.bind("drag", onDrag);
                eventHolder.bind("dragend", onDragEnd);
            }
        }

        function setMinMax ( axis , min , max , sanitize_alignment ) {
            if ( ! sanitize_alignment )
                sanitize_alignment = ALIGN_CENTER;

            var opts = axis.options ,
                zr = opts.zoomRange;

            if (min > max) {
                // make sure min < max
                var tmp = min;
                min = max;
                max = tmp;
            }

            // need to do this in case we're called before axis.min/max has been chosen
            // in which case there isn't really an existing min/max to work with so we'll
            // just use the requested one for these calculations
            var existing_min = axis.min != null ? axis.min : min;
            var existing_max = axis.max != null ? axis.max : max;

            var range = max - min;
            if (zr) {
                // Note these calculations are done in point-space, not canvas-space, so the center
                // may not be quite right when using a nonlinear transform function. The zoomRange is defined
                // in point-space coordinates and from what I can tell, getting the center right for an arbitrary
                // transform function would require some sort of numerical method. Which is overkill for a
                // corner case like this.
                // In fact, the "center" we take is the existing view's center. This stops users at maximum zoom
                // being able to "crawl" along the axis in a strange way.
                var center_proportion = sanitize_alignment === ALIGN_MIN ? 0.0 : sanitize_alignment === ALIGN_MAX ? 1.0 : 0.5;

                if (zr[0] != null && range < zr[0])
                {
                    // so we'll choose a new max & min whose range will equal the min possible zoomRange
                    min = existing_min + (( existing_max - existing_min ) - zr[0]) * center_proportion;
                    max = min + zr[0];
                    range = zr[0];
                }
                if (zr[1] != null && range > zr[1])
                {
                    // so we'll choose a new max & min whose range will equal the max possible zoomRange
                    min = existing_min + (( existing_max - existing_min ) - zr[1]) * center_proportion;
                    max = min + zr[1];
                    range = zr[1];
                }
            }

            // now also check against panRange limits if we have any
            var pr = opts.panRange;
            var pr_min_restricted = false;
            if (pr) {
                // check whether we hit the wall
                if (pr[0] != null && pr[0] > min) {
                    // ok, put the new viewport up against the min edge
                    min = pr[0];
                    max = min + range;
                    pr_min_restricted = true;
                }
                
                if (pr[1] != null && pr[1] < max) {
                    // ok, put the new viewport up against the max edge
                    max = pr[1];
                    if ( ! pr_min_restricted )
                            min = max - range;
                    // (else min is already on its limits)
                }
            }
        
            opts.min = min;
            opts.max = max;
        }

        plot.zoomOut = function (args) {
            if (!args)
                args = {};
            
            if (!args.amount)
                args.amount = plot.getOptions().zoom.amount

            args.amount = 1 / args.amount;
            plot.zoom(args);
        }
        
        plot.zoom = function (args) {
            if (!args)
                args = {};
            
            var c = args.center,
                amount = args.amount || plot.getOptions().zoom.amount,
                w = plot.width(), h = plot.height();

            if (!c)
                c = { left: w / 2, top: h / 2 };
                
            var xf = c.left / w,
                yf = c.top / h,
                minmax = {
                    x: {
                        min: c.left - xf * w / amount,
                        max: c.left + (1 - xf) * w / amount
                    },
                    y: {
                        min: c.top - yf * h / amount,
                        max: c.top + (1 - yf) * h / amount
                    }
                };

            $.each(plot.getAxes(), function(_, axis) {
                var opts = axis.options,
                    min = minmax[axis.direction].min,
                    max = minmax[axis.direction].max,
                    zr = opts.zoomRange;

                if (zr === false) // no zooming on this axis
                    return;
                    
                min = axis.c2p(min);
                max = axis.c2p(max);
                
                setMinMax ( axis , min , max );
            });
            
            plot.setupGrid();
            plot.draw();
            plot.triggerRedrawOverlay();
            
            if (!args.preventEvent)
                plot.getPlaceholder().trigger("plotzoom", [ plot ]);
        }

        plot.pan = function (args) {
            var delta = {
                x: +args.left,
                y: +args.top
            };

            if (isNaN(delta.x))
                delta.x = 0;
            if (isNaN(delta.y))
                delta.y = 0;

            $.each(plot.getAxes(), function (_, axis) {
                var opts = axis.options,
                    min, max, d = delta[axis.direction];

                min = axis.c2p(axis.p2c(axis.min) + d),
                max = axis.c2p(axis.p2c(axis.max) + d);

                if (opts.panRange === false) // no panning on this axis
                    return;
                
                setMinMax ( axis , min , max );
            });
            
            plot.setupGrid();
            plot.draw();
            plot.triggerRedrawOverlay();
            
            if (!args.preventEvent)
                plot.getPlaceholder().trigger("plotpan", [ plot ]);
        }

        plot.getRanges = function () {
            var r = {};
            $.each(plot.getAxes(), function (name, axis) {
                if (axis.used) {
                    r[name] = { from: axis.options.min != null ? axis.options.min : axis.min, to: axis.options.max != null ? axis.options.max : axis.max };
                }
            });
            return r;
        }

        // function taken from selection plugin, in turn
        // taken from markings support in Flot and then modified
        function extractRange(ranges, coord) {
            var axis, from, to, key, axes = plot.getAxes(), found_axis = false;

            for (var k in axes) {
                axis = axes[k];
                if (axis.direction == coord) {
                    key = coord + axis.n + "axis";
                    if (!ranges[key] && axis.n == 1)
                        key = coord + "axis"; // support x1axis as xaxis
                    if (ranges[key]) {
                        from = ranges[key].from;
                        to = ranges[key].to;
                        found_axis = true;
                        break;
                    }
                }
            }

            if (!found_axis)
                return null;

            // auto-reverse as an added bonus
            if (from != null && to != null && from > to) {
                var tmp = from;
                from = to;
                to = tmp;
            }

            return { from: from, to: to, axis: axis };
        }

        plot.setRanges = function (ranges , preventEvent) {
            var axis, o = plot.getOptions();

            var x_range = extractRange(ranges, "x"),
                y_range = extractRange(ranges, "y");

            if ( (x_range === null ||
                    ( x_range.axis.options.min === x_range.from && x_range.axis.options.max === x_range.to ) ) &&
                (y_range === null ||
                    ( y_range.axis.options.min === y_range.from && y_range.axis.options.max === y_range.to ) ) )
                // there's nothing to change
                return;

            if (x_range !== null)
                setMinMax ( x_range.axis, x_range.from, x_range.to,
                    x_range.axis.options.min == x_range.from ?
                    ALIGN_MIN : ( x_range.axis.options.max === x_range.to ? ALIGN_MAX : ALIGN_CENTER ) );

            if (y_range !== null)
                setMinMax ( y_range.axis, y_range.from, y_range.to,
                    y_range.axis.options.min == y_range.from ?
                    ALIGN_MIN : ( y_range.axis.options.max === y_range.to ? ALIGN_MAX : ALIGN_CENTER ) );

            if ( ! preventEvent )
                // argument is ranges object unlike other events here as we're trying to echo other plugins'
                // behaviour when changing via ranges
                plot.getPlaceholder().trigger ( "plotrangesset", [ plot.getRanges () ] );

            plot.setupGrid();
            plot.draw();
            plot.triggerRedrawOverlay();
        }

        function shutdown(plot, eventHolder) {
            eventHolder.unbind(plot.getOptions().zoom.trigger, onZoomClick);
            eventHolder.unbind("mousewheel", onMouseWheel);
            eventHolder.unbind("dragstart", onDragStart);
            eventHolder.unbind("drag", onDrag);
            eventHolder.unbind("dragend", onDragEnd);
            if (panTimeout)
                clearTimeout(panTimeout);
        }
        
        plot.hooks.processOffset.push(processOffset);
        plot.hooks.bindEvents.push(bindEvents);
        plot.hooks.shutdown.push(shutdown);
    }
    
    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'navigate',
        version: '1.3'
    });
})(jQuery);
