/*
Flot plugin for showing bar-style highlights for stepped line series
*/

(function ($) {
    var options = {
        series: {
            lines: {
                stepHighlight: false, // whether a stepped line's highlights are shown in a bar fashion
                stepHighlightColor: "#ffffff" // whether a stepped line's highlights are shown in a bar fashion
            }
        }
    };
    
    function init(plot) {
        // we only deal with one highlighted point at a time
        var highlightseries;
        var highlightindex;
        var placeholder = plot.getPlaceholder ();

        function onPlotHoverClick (event , pos, item) {
            if (item == null)
            {
                plot.stepHighlight ();
            }
            else
            {
                if (!(item.series.lines.show && item.series.lines.steps &&
                    item.series.lines.fill !== false && item.series.lines.stepsInteractivityAsBar &&
                    item.series.lines.stepHighlight))
                    return;
                plot.stepHighlight (item.series, item.dataIndex);
            }
        }

        plot.stepHighlight = function (s, pointindex) {
            if (typeof s == "number")
                s = series[s];

            if (highlightseries === s &&
                highlightindex == pointindex)
                // nothing to do
                return;

            highlightseries = s;
            highlightindex = pointindex;

            plot.triggerRedrawOverlay();
        };

        plot.hooks.bindEvents.push(function (plot, eventHolder) {
            var enabled = false;
            var series = plot.getData ();
            var s;
            for (var i = 0; i < series.length; i++) {
                s = series[i];
                if (s.lines.show && s.lines.steps &&
                    s.lines.fill !== false && s.lines.stepsInteractivityAsBar &&
                    s.lines.stepHighlight ) {
                    enabled = true;
                    break;
                }
            }
            if (!enabled)
                return;

            placeholder.on("plothover plotclick", onPlotHoverClick);
        });

        plot.coordsFromIndexSeries = function (index, series) {
            if ((index+1) * series.datapoints.pointsize >= series.datapoints.points.length)
                // there's no "next" point for the other bound of the rectangle
                return null;

            var point0 = series.datapoints.points.slice(index * series.datapoints.pointsize, (index+1) * series.datapoints.pointsize);
            var point1 = series.datapoints.points.slice((index+1) * series.datapoints.pointsize, (index+2) * series.datapoints.pointsize);

            var left = Math.min(point0[0],point1[0]);
            var right = Math.max(point0[0],point1[0]);
            var bottom = Math.min(point0[1],0.0);
            var top = Math.max(point0[1],0.0);

            if ( left > series.xaxis.max || right < series.xaxis.min || top < series.yaxis.min || bottom > series.yaxis.max )
                // rect is not in the viewport
                return null;

            left = Math.max(left,series.xaxis.min);
            right = Math.min(right,series.xaxis.max);
            bottom = Math.min(bottom,series.yaxis.max);
            top = Math.max(top,series.yaxis.min);

            r = {
                x: series.xaxis.p2c(left),
                y: series.yaxis.p2c(top)
            };
            r.w = series.xaxis.p2c(right) - r.x;
            r.h = series.yaxis.p2c(bottom) - r.y;

            return r;
        };

        plot.hooks.drawOverlay.push(function (plot, ctx) {
            if (highlightindex == null)
                return;

            var coords = plot.coordsFromIndexSeries (highlightindex, highlightseries);
            if (!coords)
                return;

            var plotOffset = plot.getPlotOffset();
            ctx.save();
                ctx.translate(plotOffset.left, plotOffset.top);
                ctx.fillStyle = $.color.parse(highlightseries.lines.stepHighlightColor).scale('a', 0.25).toString();

                ctx.fillRect(coords.x, coords.y, coords.w, coords.h);
            ctx.restore();
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            placeholder.off("plothover plotclick", onPlotHoverClick);
        });
    }
    
    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'stephighlight',
        version: '1.0'
    });
})(jQuery);
