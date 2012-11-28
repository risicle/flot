/*
Flot plugin for showing ranges of intents for tsbp

Accepts data in a slightly odd side-channel way that allows us to keep a reference to it rather than a copy which we'd have to maintain
*/

(function ($) {
    var options = {
        series: {
           intents: null , // or array of intents for points in series
           intentsFillColorFunction: null ,
           intentsStripeFunction: null
        }
    };

    function possibly_draw_area(plot, ctx, series, intent, start_index, end_index) {
        var x1 = series.datapoints.points[start_index*series.datapoints.pointsize];
        var x2 = series.datapoints.points[(end_index-1)*series.datapoints.pointsize];

        if ( x1 == null || x2 == null )
            // there is no right or left point somehow
            return;

        var x_min = Math.min ( x1 , x2 ) - 0.5;
        var x_max = Math.max ( x1 , x2 ) + 0.5;

        if ( x_max < series.xaxis.min || x_min > series.xaxis.max )
            // off plot area
            return;

        var fillcolor = series.intentsFillColorFunction ( intent );

        if ( fillcolor == null )
            return;

        ctx.save ();
            ctx.beginPath();
                ctx.rect(0, 0, plot.width(), plot.height());
            ctx.clip();

            ctx.fillStyle = fillcolor;

            ctx.beginPath();
                var x_min_coord = series.xaxis.p2c ( x_min );
                ctx.rect ( x_min_coord , 0 , series.xaxis.p2c ( x_max ) - x_min_coord , plot.height());
            ctx.fill ();
        ctx.restore ();
    }

    function init(plot) {
        plot.hooks.drawSeries.push(function (plot, ctx, series) {
            if (!(series.intents && $.isFunction(series.intentsFillColorFunction)))
                return;

            var plotOffset = plot.getPlotOffset();

            ctx.save ();
            ctx.translate ( plotOffset.left , plotOffset.top );

            var run_intent , run_start_index = 0;

            for ( var i = 0 ; i < series.intents.length ; i++ )
            {
                if ( run_intent == null )
                    run_intent = series.intents[i];

                if ( series.intents[i] !== run_intent )
                {
                    // possibly draw area of previous run
                    possibly_draw_area ( plot , ctx , series , run_intent , run_start_index , i );

                    run_intent = series.intents[i];
                    run_start_index = i;
                }
            }
            possibly_draw_area ( plot , ctx , series , run_intent , run_start_index , i );

            ctx.restore ();
        });
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'intents',
        version: '1.0'
    });
})(jQuery);
