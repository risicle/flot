/*
Flot plugin for showing "eyes on sticks" highlight visualization for tsbp
*/

(function ($) {
    var options = {
        series: {
            eoshighlight: false // whether line's points exhibit eoshighlight behaviour
        }
    };

    function init(plot) {
        var eosselectedseries;
        var eosselectedindexes = [];
        var eoshoveredseries;
        var eoshoveredindex;
        var placeholder = plot.getPlaceholder ();

        function onPlotHover (event , pos, item) {
            if (item == null)
                plot.eosHover ();
            else
                plot.eosHover (item.series, item.dataIndex);
        }

        function onPlotClick (event , pos, item) {
            if (item == null)
                plot.eosSelect ();
            else
                plot.eosSelect (item.series, item.dataIndex);
        }

        plot.eosSelect = function (s, pointindex_from, pointindex_to) {
            if (typeof s == "number")
                s = series[s];

            if (eosselectedseries === s &&
                pointindex_from == eosselectedindexes[0] &&
                pointindex_to == eosselectedindexes[1])
                // nothing to do
                return;

            eosselectedseries = s;
            eosselectedindexes = [];
            if (pointindex_from != null) {
                eosselectedindexes.push(pointindex_from);
                if (pointindex_to != null) {
                    eosselectedindexes.push(pointindex_from);
                }
            }
            placeholder.trigger ( "ploteosselected" , [ eosselectedseries , eosselectedindexes ] );
            plot.triggerRedrawOverlay();
        }

        plot.eosHover = function (s, pointindex) {
            if (typeof s == "number")
                s = series[s];

            if (eoshoveredseries === s && pointindex == eoshoveredindex)
                // nothing to do
                return;

            eoshoveredindex = pointindex;
            eoshoveredseries = s;

            placeholder.trigger ( "ploteoshovered" , [ eosselectedseries , eoshoveredindex ] );
            plot.triggerRedrawOverlay();
        }

        plot.hooks.bindEvents.push(function (plot, eventHolder) {
            var enabled = false;
            var series = plot.getData ();
            var s;
            for (var i = 0; i < series.length; i++) {
                s = series[i];
                if (s.eoshighlight) {
                    enabled = true;
                    break;
                }
            }
            if (!enabled)
                return;

            placeholder.on("plothover", onPlotHover);
            placeholder.on("plotclick", onPlotClick);
        });

        plot.hooks.drawOverlay.push(function (plot, ctx) {
            if (eoshoveredindex == null && !eosselectedindexes.length)
                // nothing to draw
                return;

            var plotOffset = plot.getPlotOffset();
            var point, point_x, point_y, xaxis, yaxis, radius;
            var x, y;

            ctx.save();
            ctx.translate(plotOffset.left, plotOffset.top);

            if (eosselectedindexes.length) {
                radius = eosselectedseries.points.radius;
                ctx.lineWidth = eosselectedseries.points.lineWidth;
                ctx.strokeStyle = $.color.parse(eosselectedseries.color).toString();

                xaxis = eosselectedseries.xaxis;
                yaxis = eosselectedseries.yaxis;

                for (var i = 0; i < eosselectedindexes.length; i++) {
                    point = eosselectedseries.datapoints.points.slice(eosselectedindexes[i] * eosselectedseries.datapoints.pointsize, (eosselectedindexes[i]+1) * eosselectedseries.datapoints.pointsize);
                    if ( point[0] < xaxis.min || point[0] > xaxis.max || point[1] < yaxis.min || point[1] > yaxis.max )
                        continue;

                    x = xaxis.p2c(point[0]);
                    y = yaxis.p2c(point[1]);

                    ctx.beginPath();
                        ctx.arc(x, y, radius, 0.5 * Math.PI, 2.5 * Math.PI, false);
                        ctx.lineTo(x, plot.height());
                    ctx.closePath();

                    ctx.stroke();
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
                    y = yaxis.p2c(point[1]);

                    ctx.beginPath();
                        ctx.arc(x, y, radius, 0.5 * Math.PI, 2.5 * Math.PI, false);
                    ctx.closePath();

                    ctx.fill();

                    ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, plot.height());
                    ctx.closePath();

                    ctx.stroke();
                }
            }

            ctx.restore();
        });

        plot.hooks.shutdown.push(function (plot, eventHolder) {
            placeholder.off("plothover", onPlotHover);
            placeholder.off("plotclick", onPlotClick);
        });
    }
    
    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'eoshighlight',
        version: '1.0'
    });
})(jQuery);