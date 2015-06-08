var postcss = require('postcss');
var expect  = require('chai').expect;

var plugin = require('../');

var test = function (input, output, opts, done) {
    postcss([ plugin(opts) ]).process(input).then(function (result) {
        expect(result.css).to.eql(output);
        expect(result.warnings()).to.be.empty;
        done();
    }).catch(function (error) {
        done(error);
    });
};

describe('postcss-unprefixer', function () {
    it('rewriting linear gradient', function (done) {
        test('b{background: -webkit-gradient(linear, left top, left bottom, color-stop(0, #ffffff), to(#f0efe7));}', 'b{background: -webkit-gradient(linear, left top, left bottom, color-stop(0, #ffffff), to(#f0efe7));background: linear-gradient(to bottom, #ffffff 0%, #f0efe7 100%);}', {}, done);
    });
    it('rewriting radial gradient', function (done) {
        test('b{background: -webkit-gradient(radial, 45 45, 10, 52 50, 30, from(#A7D30C), to(rgba(1,159,98,0)), color-stop(90%, #019F62)), -webkit-gradient(radial, 105 105, 20, 112 120, 50, from(#ff5f98), to(rgba(255,1,136,0)), color-stop(75%, #ff0188)), -webkit-gradient(radial, 95 15, 15, 102 20, 40, from(#00c9ff), to(rgba(0,201,255,0)), color-stop(80%, #00b5e2)), -webkit-gradient(radial, 0 150, 50, 0 140, 90, from(#f4f201), to(rgba(228, 199,0,0)), color-stop(80%, #e4c700));}', 'b{background: -webkit-gradient(radial, 45 45, 10, 52 50, 30, from(#A7D30C), to(rgba(1,159,98,0)), color-stop(90%, #019F62)), -webkit-gradient(radial, 105 105, 20, 112 120, 50, from(#ff5f98), to(rgba(255,1,136,0)), color-stop(75%, #ff0188)), -webkit-gradient(radial, 95 15, 15, 102 20, 40, from(#00c9ff), to(rgba(0,201,255,0)), color-stop(80%, #00b5e2)), -webkit-gradient(radial, 0 150, 50, 0 140, 90, from(#f4f201), to(rgba(228, 199,0,0)), color-stop(80%, #e4c700));background: radial-gradient(circle 30px at 45px 45px, #A7D30C 0%, #019F62 90%, rgba(1, 159, 98, 0) 100%), radial-gradient(circle 50px at 105px 105px, #ff5f98 0%, #ff0188 75%, rgba(255, 1, 136, 0) 100%), radial-gradient(circle 40px at 95px 15px, #00c9ff 0%, #00b5e2 80%, rgba(0, 201, 255, 0) 100%), radial-gradient(circle 90px at 0px 150px, #f4f201 0%, #e4c700 80%, rgba(228, 199, 0, 0) 100%);}', {}, done);
    });

});
