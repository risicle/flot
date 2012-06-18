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

        plot.hooks.drawOverlay.push(function (plot, ctx) {
            if (highlightindex == null)
                return;

            if ((highlightindex+1) * highlightseries.datapoints.pointsize >= highlightseries.datapoints.points.length)
                // there's no "next" point for the other bound of the rectangle
                return;

            var plotOffset = plot.getPlotOffset();
            var point0 = highlightseries.datapoints.points.slice(highlightindex * highlightseries.datapoints.pointsize, (highlightindex+1) * highlightseries.datapoints.pointsize);
            var point1 = highlightseries.datapoints.points.slice((highlightindex+1) * highlightseries.datapoints.pointsize, (highlightindex+2) * highlightseries.datapoints.pointsize);

            var left = Math.min(point0[0],point1[0]);
            var right = Math.max(point0[0],point1[0]);
            var bottom = Math.min(point0[1],0.0);
            var top = Math.max(point0[1],0.0);

            if ( left > highlightseries.xaxis.max || right < highlightseries.xaxis.min || top < highlightseries.yaxis.min || bottom > highlightseries.yaxis.max )
                return;

            left = Math.max(left,highlightseries.xaxis.min);
            right = Math.min(right,highlightseries.xaxis.max);
            bottom = Math.min(bottom,highlightseries.yaxis.max);
            top = Math.max(top,highlightseries.yaxis.min);

            var x = highlightseries.xaxis.p2c(left);
            var y = highlightseries.yaxis.p2c(top);
            var w = highlightseries.xaxis.p2c(right) - x;
            var h = highlightseries.yaxis.p2c(bottom) - y;

            ctx.save();
                ctx.translate(plotOffset.left, plotOffset.top);
                ctx.fillStyle = $.color.parse(highlightseries.lines.stepHighlightColor).scale('a', 0.25).toString();

                ctx.fillRect(x,y,w,h);
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
