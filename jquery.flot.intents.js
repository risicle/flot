/*
Flot plugin for showing ranges of intents for tsbp

Accepts data in a slightly odd side-channel way that allows us to keep a reference to it rather than a copy which we'd have to maintain
*/

(function ($) {
    var options = {
        series: {
           intents: null , // or array of intents for points in series
           intentsTryFillColor: "rgba(0,0,0,0.2)" ,
           intentsNullMarkingColor: "rgba(0,0,50,0.2)"
        }
    };

    function init(plot) {
        plot.hooks.drawSeries.push(function (plot, ctx, series) {
            if (!series.intents)
                return;

            // drawing code goes here
        });
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'intents',
        version: '1.0'
    });
})(jQuery);
