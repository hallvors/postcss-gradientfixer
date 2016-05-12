var postcss = require( 'postcss' );

module.exports = postcss.plugin( 'postcss-flexboxfixer', function( opts ) {
    opts = opts || {};

    function getValueForProperty(parent, name, prefixAgnostic){
        var retValue;
        parent.walkDecls(prefixAgnostic ? new RegExp('^(?:-\\w-)?' + name + '$') : name, function(decl) {
            retValue = decl.value;
        });
        return retValue;
    }

    function colorValue(obj){
        var ar = [];
        for (var i = 0; i < obj.length; i++) {
            ar.push(obj[i].name);
        }
        return ar.join(', ');
    }

    /* Given an array of args for "-webkit-gradient(...)" returned by
     * oldGradientParser(), this function constructs a string representing the
     * equivalent arguments for a standard "linear-gradient(...)" or
     * "radial-gradient(...)" expression.
     *
     * @param type  Either 'linear' or 'radial'.
     * @param args  An array of args for a "-webkit-gradient(...)" expression,
     *              provided by oldGradientParser() (not including gradient type).
     */
    function standardizeOldGradientArgs(type, args){
        var stdArgStr = '';
        var stops = [];
        if(/^linear/.test(type)){
            // linear gradient, args 1 and 2 tend to be start/end keywords
            var points = [].concat(args[0].name.split(/\s+/), args[1].name.split(/\s+/)); // example: [left, top, right, top]
            // Old webkit syntax "uses a two-point syntax that lets you explicitly state where a linear gradient starts and ends"
            // if start/end keywords are percentages, let's massage the values a little more..
            var rxPercTest = /\d+\%/;
            if(rxPercTest.test(points[0]) || points[0] === 0){
                var startX = parseInt(points[0]), startY = parseInt(points[1]), endX = parseInt(points[2]), endY = parseInt(points[3]);
                stdArgStr += Math.atan2(endY - startY, endX - startX) * (180 / Math.PI) + 90;
                stdArgStr += 'deg';
            }else{
                if(points[1] === points[3]){ // both 'top' or 'bottom, this linear gradient goes left-right
                    stdArgStr += 'to ' + points[2];
                }else if(points[0] === points[2]){ // both 'left' or 'right', this linear gradient goes top-bottom
                    stdArgStr += 'to ' + points[3];
                }else if(points[1] === 'top'){ // diagonal gradient - from top left to opposite corner is 135deg
                    stdArgStr += '135deg';
                }else{
                    stdArgStr += '45deg';
                }
            }

        }else if(/^radial/i.test(type)){ // oooh, radial gradients..
            stdArgStr += 'circle ' + args[3].name.replace(/(\d+)$/, '$1px') + ' at ' + args[0].name.replace(/(\d+) /, '$1px ').replace(/(\d+)$/, '$1px');
        }

        var toColor;
        var startStep = type === 'linear' ? 2 : 4;
        for (var j = startStep; j < args.length; j++) {
            var position, color, colorIndex;
            if(args[j].name === 'color-stop'){
                position = args[j].args[0].name;
                if (args[j].args[1]) {
                    colorIndex = 1;
                } else {
                    colorIndex = 0;
                    position = (j - startStep) / (args.length - startStep - 1);
                }
            }else if (args[j].name === 'to') {
                position = '100%';
                colorIndex = 0;
            }else if (args[j].name === 'from') {
                position = '0%';
                colorIndex = 0;
            }
            if (position >= 0 || position.indexOf('%') === -1) { // original Safari syntax had 0.5 equivalent to 50%
                position = parseFloat(position) * 100 + '%';
            }
            color = args[j].args[colorIndex].name;
            if (args[j].args[colorIndex].args) { // the color is itself a function call, like rgb()
                color += '(' + colorValue(args[j].args[colorIndex].args) + ')';
            }
            if (args[j].name === 'from'){
                stops.unshift(color + ' ' + position);
            }else if(args[j].name === 'to'){
                toColor = color;
            }else{
                stops.push(color + ' ' + position);
            }
        }

        // translating values to right syntax
        for(j = 0; j < stops.length; j++){
            stdArgStr += ', ' + stops[j];
        }
        if(toColor){
            stdArgStr += ', ' + toColor + ' 100%';
        }
        return stdArgStr;
    }

    function oldGradientParser(str){
        /** This method takes a legacy -webkit-gradient() method call and parses it
            to pull out the values, function names and their arguments.
            It returns something like [{name:'-webkit-gradient',args:[{name:'linear'}, {name:'top left'} ... ]}]
        */
        var objs = [{}], path = [], current, word = '', separatorChars = [',', '(', ')'];
        current = objs[0];
        path[0] = objs;
        //str = str.replace(/\s*\(/g, '('); // sorry, ws in front of ( would make parsing a lot harder
        for(var i = 0; i < str.length; i++){
            if(separatorChars.indexOf(str[i]) === -1){
                word += str[i];
            }else{ // now we have a "separator" - presumably we've also got a "word" or value
                current.name = word.trim();
                //GM_log(word+' '+path.length+' '+str[i])
                word = '';
                if(str[i] === '('){ // we assume the 'word' is a function, for example -webkit-gradient() or rgb(), so we create a place to record the arguments
                    if(!('args' in current)){
                        current.args = [];
                    }
                    current.args.push({});
                    path.push(current.args);
                    current = current.args[current.args.length - 1];
                    path.push(current);
                }else if(str[i] === ')'){ // function is ended, no more arguments - go back to appending details to the previous branch of the tree
                    current = path.pop(); // drop 'current'
                    current = path.pop(); // drop 'args' reference
                }else{
                    path.pop(); // remove 'current' object from path, we have no arguments to add
                    var currentParent = path[path.length - 1] || objs; // last object on current path refers to array that contained the previous "current"
                    currentParent.push({}); // we need a new object to hold this "word" or value
                    current = currentParent[currentParent.length - 1]; // that object is now the 'current'
                    path.push(current);
    //GM_log(path.length)
                }
            }
        }

        return objs;
    }
    function createFixupGradientDeclaration(prop, value){
        value = value.trim();
        var newValue = '', rxfix, i;
        prop = postcss.vendor.unprefixed(prop);
        // -webkit-gradient(<type>, <point> [, <radius>]?, <point> [, <radius>]? [, <stop>]*)
        // fff -webkit-gradient(linear,0 0,0 100%,from(#fff),to(#f6f6f6));
        // Sometimes there is code before the -webkit-gradient, for example when it's part of a more complex background: shorthand declaration
        // we'll extract and keep any stuff before -webkit-gradient before we try parsing the gradient part
        var head = value.substr(0, value.indexOf('-webkit-gradient'));
        if(head){
            value = value.substr(head.length);
        }
        var m = value.match(/-webkit-gradient\s*\(\s*(linear|radial)\s*(.*)/);
        if(m){ // yay, really old syntax...

            // extracting the values..
            var parts = oldGradientParser(value), type; //GM_log(JSON.stringify(parts, null, 2))
            for(i = 0; i < parts.length; i++){
                if(!parts[i].args)continue;
                if(parts[i].name === '-webkit-gradient'){
                    type = parts[i].args[0].name;
                    newValue += type + '-gradient('; // radial or linear
                    rxfix = new RegExp('(^|\s)' + type + '-gradient\\(', '');
                }
                newValue += standardizeOldGradientArgs(type, parts[i].args.slice(1));
                newValue += ')'; // end of gradient method
                if (i < parts.length - 1) {
                    newValue += ', ';
                }
            }
        }else{ // we're dealing with more modern syntax - should be somewhat easier, at least for linear gradients.
            // Fix three things: remove -webkit-, add 'to ' before reversed top/bottom keywords (linear) or 'at ' before position keywords (radial), recalculate deg-values
            // -webkit-linear-gradient( [ [ <angle> | [top | bottom] || [left | right] ],]? <color-stop>[, <color-stop>]+);
            newValue = value.replace(/(^|\s|,)-\w+-/g, '$1');
            // Keywords top, bottom, left, right: can be stand-alone or combined pairwise but in any order ('top left' or 'left top')
            // These give the starting edge or corner in the -webkit syntax. The standardised equivalent is 'to ' plus opposite values for linear gradients, 'at ' plus same values for radial gradients
            if(newValue.indexOf('linear') > -1){
                newValue = newValue.replace(/(top|bottom|left|right)+\s*(top|bottom|left|right)*/, function(str){
                    var words = str.split(/\s+/);
                    for(i = 0; i < words.length; i++){
                        switch(words[i].toLowerCase()){
                            case 'top':
                                words[i] = 'bottom';
                                break;
                            case 'bottom':
                                words[i] = 'top';
                                break;
                            case 'left':
                                words[i] = 'right';
                                break;
                            case 'right':
                                words[i] = 'left';
                        }
                    }
                    str = words.join(' ');
                    return 'to ' + str;
                });
                rxfix = /(^|\s)linear-gradient\(/;
            }else{
                newValue = newValue.replace(/(top|bottom|left|right)+\s/, 'at $1 ');
                rxfix = /(^|\s)radial-gradient\(/;
            }

            newValue = newValue.replace(/\d+deg/, function (val) {
                 return 360 - parseInt(val) - 90 + 'deg';
             });

        }
        // Similar to the code for "head" above..
        var tail = value.substr(value.lastIndexOf(')') + 1);
        if( tail && tail.trim() !== ','){ // sometimes the gradient is a part of a more complex declaration (for example an image shorthand with stuff like no-repeat added), and what's after the gradient needs to be included
            newValue += tail;
        }
        if(head){
            newValue = head + newValue;
        }
        // GM_log(newValue)
        return {type:'declaration', property:prop, value:newValue, rxfix:rxfix};
    }

    return function( css ) {
        css.walkDecls(function(decl) {
            if(!/-(?:webkit|\w+(?:-\w+)+)-gradient/.test(decl.value)){
                /* no -webkit- gradient syntax here, move on */
                return;
            }
            var fixedDecl = createFixupGradientDeclaration(decl.prop, decl.value);
            /* we only add fixup rules if there's no equivalent rule in the CSS rule set already.. */
            var existingValue = getValueForProperty(decl.parent, decl.prop, false);
            if(!(existingValue === fixedDecl.value || fixedDecl.rxfix.test(existingValue))){
                decl.cloneAfter({'prop':fixedDecl.property, 'value':fixedDecl.value});
            }
        } );
    };
} );
