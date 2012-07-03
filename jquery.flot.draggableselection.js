/*
Flot plugin for draggable selected regions.

Based on selection plugin, this plugin allows the user to drag the edges
of the selection to alter it, or even drag the whole selection around.

Depends on threedubmedia's jquery.event.drag.js, as included in navigate
plugin.

The plugin defines the following options:

  draggableselection: {
    mode: null or "x" or "y" or "xy",
    color: color,
    invertFill: false,
    edgetolerance: 4
  }

Selection support is enabled by setting the mode to one of "x", "y" or
"xy". In "x" mode, the user will only be able to specify the x range,
similarly for "y" mode. For "xy", the selection becomes a rectangle
where both ranges can be specified. "color" is color of the selection
(if you need to change the color later on, you can get to it with
plot.getOptions().selection.color).

When draggableselection support is enabled, a "plotselecting" event will be
emitted on the DOM element you passed into the plot function.  The
event handler gets a parameter with the ranges selected on the axes,
like this:

  placeholder.bind("plotselecting", function(event, ranges) {
    alert("You selected " + ranges.xaxis.from + " to " + ranges.xaxis.to)
    // similar for yaxis - with multiple axes, the extra ones are in
    // x2axis, x3axis, ...
  });

The "plotselected" events are fired continually as the user alters the
selection.

The plugin allso adds the following methods to the plot object:

- setSelection(ranges, preventEvent)

  Set the selection rectangle. The passed in ranges is on the same
  form as returned in the "plotselecting" event. If the selection mode
  is "x", you should put in either an xaxis range, if the mode is "y"
  you need to put in an yaxis range and both xaxis and yaxis if the
  selection mode is "xy", like this:

    setSelection({ xaxis: { from: 0, to: 10 }, yaxis: { from: 40, to: 60 } });

  setSelection will trigger the "plotselecting" event when called. If
  you don't want that to happen, e.g. if you're inside a
  "plotselecting" handler, pass true as the second parameter. If you
  are using multiple axes, you can specify the ranges on any of those,
  e.g. as x2axis/x3axis/... instead of xaxis, the plugin picks the
  first one it sees.
  
- clearSelection(preventEvent)

  Sets the selection to the plot boundary in an attempt at some
  compatibility with selection plugin.

- getSelection()

  Returns the current selection in the same format as the
  "plotselecting" event.

*/

(function ($) {
    function init(plot) {
        var selection;
        // a useful thing to be able to take a copy of
        var dragging_nothing = {
            first_x : false ,
            second_x : false ,
            first_y : false ,
            second_y : false
        };

        function determineMouseOver ( pageX , pageY ) {
            var o = plot.getOptions();
            var placeholder_offset = plot.getPlaceholder ().offset ();
            var offset = plot.getPlotOffset ();

            var offset_start_x = pageX - ( offset.left + placeholder_offset.left );
            var offset_start_y = pageY - ( offset.top + placeholder_offset.top );

            // we use & re-use all these conditions so much we may as well pre-calculate them,
            // also adding clarity where they're used.
            var on_first_x = Math.abs ( selection.first.x - offset_start_x ) <= o.draggableselection.edgetolerance ,
            on_second_x = Math.abs ( selection.second.x - offset_start_x ) <= o.draggableselection.edgetolerance ,
            on_first_y = Math.abs ( selection.first.y - offset_start_y ) <= o.draggableselection.edgetolerance ,
            on_second_y = Math.abs ( selection.second.y - offset_start_y ) <= o.draggableselection.edgetolerance ,
            between_first_second_x = selection.first.x - o.draggableselection.edgetolerance <= offset_start_x && offset_start_x <= selection.second.x + o.draggableselection.edgetolerance ,
            between_first_second_y = selection.first.y - o.draggableselection.edgetolerance <= offset_start_y && offset_start_y <= selection.second.y + o.draggableselection.edgetolerance ;

            var pickup = $.extend ( {} , dragging_nothing );

            if ( o.draggableselection.mode == "x"
                && offset_start_y >= 0 && offset_start_y <= plot.height() ) // ensure pointer in plot area y extent
            {
                if ( on_first_x )
                    pickup.first_x = true;
                else if ( on_second_x )
                    pickup.second_x = true;
                else if ( between_first_second_x )
                    pickup.first_x = pickup.second_x = true;
            }
            else if ( o.draggableselection.mode == "y"
                && offset_start_x >= 0 && offset_start_x <= plot.width() ) // ensure pointer in plot area x extent
            {
                if ( on_first_y )
                    pickup.first_y = true;
                else if ( on_second_y )
                    pickup.second_y = true;
                else if ( between_first_second_y )
                    pickup.first_y = pickup.second_y = true;
            }
            else if ( o.draggableselection.mode == "xy" )
            {
                if ( on_first_x && between_first_second_y )
                    pickup.first_x = true;
                else if ( on_second_x && between_first_second_y )
                    pickup.second_x = true;

                if ( on_first_y && between_first_second_x )
                    pickup.first_y = true;
                else if ( on_second_y && between_first_second_x )
                    pickup.second_y = true;

                // not picked up anything yet?
                if ( ! ( pickup.first_x || pickup.second_x || pickup.first_y || pickup.second_y ) )
                    if ( between_first_second_x && between_first_second_y )
                        pickup.first_y = pickup.second_y = pickup.first_x = pickup.second_x = true;
            }

            return pickup; // a simple true/false object
        }

        function onDragStart ( event , dragdrop ) {
            var pickup = determineMouseOver ( dragdrop.startX , dragdrop.startY );

            if ( ! ( pickup.first_x || pickup.second_x || pickup.first_y || pickup.second_y ) )
                return false;

            if ( pickup.first_x )
                pickup.first_x = selection.first.x;
            if ( pickup.second_x )
                 pickup.second_x = selection.second.x;
            if ( pickup.first_y )
                pickup.first_y = selection.first.y;
            if ( pickup.second_y )
                pickup.second_y = selection.second.y;

            selection.dragging = pickup;

            plot.getPlaceholder().trigger ( "plotselectstart", [ getSelection () , $.extend ( {} , selection.dragging ) , dragdrop ] );

            // TODO force cursor of <body> element during drag?
        }

        function onMouseMove ( event ) {
            if ( selection.dragging.first_x !== false || selection.dragging.second_x !== false || selection.dragging.first_y !== false || selection.dragging.second_y !== false )
                // we're dragging something - leave this alone
                return;

            var pickup = determineMouseOver ( event.pageX , event.pageY );
            var placeholder = plot.getPlaceholder ();

            if ( ( pickup.first_x && pickup.second_x ) || ( pickup.first_y && pickup.second_y ) )
                placeholder.css ( "cursor" , "move" );
            else if ( pickup.first_x && pickup.first_y )
                placeholder.css ( "cursor" , "nw-resize" );
            else if ( pickup.second_x && pickup.second_y )
                placeholder.css ( "cursor" , "se-resize" );
            else if ( pickup.first_x && pickup.second_y )
                placeholder.css ( "cursor" , "sw-resize" );
            else if ( pickup.second_x && pickup.first_y )
                placeholder.css ( "cursor" , "ne-resize" );
            else if ( pickup.first_x )
                placeholder.css ( "cursor" , "w-resize" );
            else if ( pickup.second_x )
                placeholder.css ( "cursor" , "e-resize" );
            else if ( pickup.first_y )
                placeholder.css ( "cursor" , "n-resize" );
            else if ( pickup.second_y )
                placeholder.css ( "cursor" , "s-resize" );
            else
                placeholder.css ( "cursor" , "" );
        }

        function onDrag ( event , dragdrop ) {
            if ( selection.dragging.first_x === false && selection.dragging.second_x === false && selection.dragging.first_y === false && selection.dragging.second_y === false )
                // huh? go away.
                return false;

            if ( selection.dragging.first_x !== false )
                selection.first.x = selection.dragging.first_x + dragdrop.deltaX;
            if ( selection.dragging.second_x !== false )
                selection.second.x = selection.dragging.second_x + dragdrop.deltaX;
            if ( selection.dragging.first_y !== false )
                selection.first.y = selection.dragging.first_y + dragdrop.deltaY;
            if ( selection.dragging.second_y !== false )
                selection.second.y = selection.dragging.second_y + dragdrop.deltaY;

            //
            // Do some sanitizing
            //

            if ( selection.dragging.first_x !== false && selection.dragging.second_x !== false )
            {
                // we'll want to attempt to maintain the width of the selection
                if ( selection.first.x < 0 )
                {
                    selection.second.x -= selection.first.x;
                    selection.first.x = 0;
                }
                if ( selection.second.x >= plot.width () )
                {
                    selection.first.x -= selection.second.x - ( plot.width () - 1 );
                    selection.second.x = plot.width () - 1;
                }
            }
            else if ( selection.dragging.first_x !== false )
            {
                if ( selection.first.x > selection.second.x )
                    selection.first.x = selection.second.x;
                if ( selection.first.x < 0 )
                    selection.first.x = 0;
            }
            else if ( selection.dragging.second_x !== false )
            {
                if ( selection.first.x > selection.second.x )
                    selection.second.x = selection.first.x;
                if ( selection.second.x >= plot.width () )
                    selection.second.x = plot.width () - 1;
            }

            if ( selection.dragging.first_y !== false && selection.dragging.second_y !== false )
            {
                // we'll want to attempt to maintain the height of the selection
                if ( selection.first.y < 0 )
                {
                    selection.second.y -= selection.first.y;
                    selection.first.y = 0;
                }
                if ( selection.second.y >= plot.height () )
                {
                    selection.first.y -= selection.second.y - ( plot.height () - 1 );
                    selection.second.y = plot.height () - 1;
                }
            }
            else if ( selection.dragging.first_y !== false )
            {
                if ( selection.first.y > selection.second.y )
                    selection.first.y = selection.second.y;
                if ( selection.first.y < 0 )
                    selection.first.y = 0;
            }
            else if ( selection.dragging.second_y !== false )
            {
                if ( selection.first.y > selection.second.y )
                    selection.second.y = selection.first.y;
                if ( selection.second.y >= plot.height () )
                    selection.second.y = plot.height () - 1;
            }

            plot.getPlaceholder().trigger ( "plotselecting", [ getSelection () , $.extend ( {} , selection.dragging ) ] );

            plot.triggerRedrawOverlay ();
        }

        function onDragEnd ( event , dragdrop ) {
            // ensure selection is up to date
            onDrag ( event , dragdrop );
            plot.getPlaceholder().trigger ( "plotselectend", [ getSelection () , $.extend ( {} , selection.dragging ) , dragdrop ] );

            selection.dragging = $.extend ( {} , dragging_nothing );
        }

        function getSelection() {
            var r = {}, c1 = selection.first, c2 = selection.second;
            $.each(plot.getAxes(), function (name, axis) {
                if (axis.used) {
                    var p1 = axis.c2p(c1[axis.direction]), p2 = axis.c2p(c2[axis.direction]); 
                    r[name] = { from: Math.min(p1, p2), to: Math.max(p1, p2) };
                }
            });
            return r;
        }

        function clearSelection(preventEvent) {
            setInitialSelection ();
            plot.triggerRedrawOverlay();
        }

        // function taken from markings support in Flot
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
        
        function setSelection(ranges, preventEvent) {
            var axis, o = plot.getOptions(),
                x_range = extractRange(ranges, "x"),
                y_range = extractRange(ranges, "y"),
                desired_min_x, desired_max_x, desired_change_x = false,
                desired_min_y, desired_max_y, desired_change_y = false;

            if (x_range !== null) {
                desired_min_x = x_range.axis.p2c(x_range.from);
                desired_max_x = x_range.axis.p2c(x_range.to);
                if (desired_min_x !== selection.first.x || desired_max_x !== selection.second.x)
                    desired_change_x = true;
            }

            if (y_range !== null) {
                desired_min_y = y_range.axis.p2c(y_range.from);
                desired_max_y = y_range.axis.p2c(y_range.to);
                if (desired_min_y !== selection.first.y || desired_max_y !== selection.second.y)
                    desired_change_y = true;
            }

            if (!(desired_change_x || desired_change_y))
                // there's nothing to change
                return;

            if (o.draggableselection.mode == "y") {
                selection.first.x = 0;
                selection.second.x = plot.width() - 1;
            }
            else if (x_range !== null) {
                selection.first.x = desired_min_x;
                selection.second.x = desired_max_x;
            }

            if (o.draggableselection.mode == "x") {
                selection.first.y = 0;
                selection.second.y = plot.height() - 1;
            }
            else if (y_range !== null) {
                selection.first.y = desired_min_y;
                selection.second.y = desired_max_y;
            }

            plot.triggerRedrawOverlay();
            if ( ! preventEvent )
                plot.getPlaceholder().trigger ( "plotselecting", [ getSelection () , $.extend ( {} , selection.dragging ) ] );
        }

        function setInitialSelection () {
            var o = plot.getOptions();
            if (o.draggableselection.mode != null) {
                selection = {
                    // unlike the selection plugin, first coordinates must always be <= second coordinates
                    first: { x: 0, y: 0}, second: { x: plot.width () - 1, y: plot.height () - 1 } ,
                    // dragging: an object holding either the starting cursor offset for each of (first|second)_(x|y) or false if
                    // the coordinate is not being dragged
                    dragging: $.extend ( {} , dragging_nothing )
                };
            }
        }

        function emitEdgeHandle ( ctx ) {
            // expecting ctx's transform stack to be set up to
            // allow us to work in -1 to +1 domain
            ctx.moveTo ( 0 , 1 );
            ctx.lineTo ( 1 , 0 );
            ctx.lineTo ( 0 , -1 );
            ctx.lineTo ( -1 , 0 );
            ctx.closePath ();
        }

        plot.clearSelection = clearSelection;
        plot.setSelection = setSelection;
        plot.getSelection = getSelection;

        // just need to do this somewhere where the canvas has been set up so we
        // can use plot.width () & plot.height ()
        plot.hooks.drawBackground.push( setInitialSelection );

        plot.hooks.bindEvents.push(function(plot, eventHolder) {
            var o = plot.getOptions();
            if (o.draggableselection.mode != null) {
                eventHolder.on ( "mousemove" , onMouseMove );
                eventHolder.on ( "dragstart" , onDragStart );
                eventHolder.on ( "drag" , onDrag );
                eventHolder.on ( "dragend" , onDragEnd );

                // hopefully this should get deferred until our drawOverlay function is actually added
                plot.triggerRedrawOverlay ();
            }
        });


        plot.hooks.drawOverlay.push(function (plot, ctx) {
            // draw selection
            var o = plot.getOptions();
            if ( o.draggableselection && o.draggableselection.mode !== null ) {
                var plotOffset = plot.getPlotOffset();

                ctx.save();
                ctx.translate(plotOffset.left, plotOffset.top);

                var color = $.color.parse(o.draggableselection.color);
                var fillColor = o.draggableselection.fillColor ? $.color.parse(o.draggableselection.fillColor) : $.color.parse(o.draggableselection.color).scale ( "a" , 0.5 );

                ctx.strokeStyle = color.toString();
                ctx.lineWidth = o.draggableselection.edgeLineWidth;
                ctx.lineCap = "round";
                ctx.fillStyle = fillColor.toString();

                var x = Math.min(selection.first.x, selection.second.x),
                    y = Math.min(selection.first.y, selection.second.y),
                    w = Math.abs(selection.second.x - selection.first.x),
                    h = Math.abs(selection.second.y - selection.first.y);

                if ( o.draggableselection.invertFill )
                {
                    if ( o.draggableselection.mode == "x" || o.draggableselection.mode == "xy") {
                        ctx.fillRect ( 0 , 0 , selection.first.x , plot.height () );
                        ctx.fillRect ( selection.second.x , 0 , plot.width () - selection.second.x , plot.height () );
                    }

                    if ( o.draggableselection.mode == "y" || o.draggableselection.mode == "xy") {
                        ctx.fillRect ( selection.first.x , 0 , selection.second.x - selection.first.x , selection.first.y );
                        ctx.fillRect ( selection.first.x , selection.second.y , selection.second.x - selection.first.x , plot.height () - selection.second.y );
                    }
                }
                else
                {
                    ctx.fillRect(x, y, w, h);
                }

                ctx.beginPath ();
                if ( o.draggableselection.mode == "x" || o.draggableselection.mode == "xy") {
                    ctx.moveTo ( x , y );
                    ctx.lineTo ( x , y + h );
                    ctx.moveTo ( x + w , y );
                    ctx.lineTo ( x + w , y + h );
                }
                if ( o.draggableselection.mode == "y" || o.draggableselection.mode == "xy") {
                    ctx.moveTo ( x , y );
                    ctx.lineTo ( x + w , y );
                    ctx.moveTo ( x , y + h );
                    ctx.lineTo ( x + w , y + h );
                }
                ctx.stroke();

                ctx.fillStyle = color.toString();
                ctx.beginPath ();
                if ( o.draggableselection.edgeHandleSize ) {
                    if ( o.draggableselection.mode == "x" || o.draggableselection.mode == "xy") {
                        ctx.save ();
                            ctx.translate ( x , y + (h/2) );
                            ctx.scale ( o.draggableselection.edgeHandleSize , o.draggableselection.edgeHandleSize );
                            emitEdgeHandle ( ctx );
                        ctx.restore ();
                        ctx.save ();
                            ctx.translate ( x + w , y + (h/2) );
                            ctx.scale ( o.draggableselection.edgeHandleSize , o.draggableselection.edgeHandleSize );
                            emitEdgeHandle ( ctx );
                        ctx.restore ();
                    }
                    if ( o.draggableselection.mode == "y" || o.draggableselection.mode == "xy") {
                        ctx.save ();
                            ctx.translate ( x + (w/2) , y );
                            ctx.scale ( o.draggableselection.edgeHandleSize , o.draggableselection.edgeHandleSize );
                            emitEdgeHandle ( ctx );
                        ctx.restore ();
                        ctx.save ();
                            ctx.translate ( x + (w/2) , y + h );
                            ctx.scale ( o.draggableselection.edgeHandleSize , o.draggableselection.edgeHandleSize );
                            emitEdgeHandle ( ctx );
                        ctx.restore ();
                    }
                }
                ctx.fill();

                ctx.restore();
            }
        });
        
        plot.hooks.shutdown.push(function (plot, eventHolder) {
            eventHolder.off ( "mousemove" , onMouseMove );
            eventHolder.off ( "dragstart" , onDragStart );
            eventHolder.off ( "drag" , onDrag );
            eventHolder.off ( "dragend" , onDragEnd );
        });

    }

    $.plot.plugins.push({
        init: init,
        options: {
            draggableselection: {
                mode: null, // one of null, "x", "y" or "xy"
                color: "rgba(232,207,172,0.8)",
                fillColor: null,
                edgetolerance: 4 ,
                edgeHandleSize: 6 ,
                edgeLineWidth: 1 ,
                invertFill: false
            }
        },
        name: 'draggableselection',
        version: '1.0'
    });
})(jQuery);
