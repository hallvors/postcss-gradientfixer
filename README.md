# PostCSS gradientfixer [![Build Status][ci-img]][ci]

[PostCSS] plugin to rewrite code with existing vendor prefixes (especially -webkit-) on CSS gradients and add equivalent un-prefixed CSS.

[PostCSS]: https://github.com/postcss/postcss
[ci-img]:  https://travis-ci.org/hallvors/postcss-gradientfixer.svg
[ci]:      https://travis-ci.org/hallvors/postcss-gradientfixer

For example, here's some CSS with vendor-specific prefix and a gradient syntax based on older versions of the CSS specifications:

```css
.foo {
  background: -webkit-gradient(linear, left top, left bottom, color-stop(0, #ffffff), to(#f0efe7));
}
```

The unprefixer plugin will add the equivalent standard declarations (while leaving the old CSS for backwards compatibility with older WebKit-based browsers):

```css
.foo {
  background: -webkit-gradient(linear, left top, left bottom, color-stop(0, #ffffff), to(#f0efe7));
  background: linear-gradient(to bottom, #ffffff 0%, #f0efe7 100%);
}
```

## Usage

```js
postcss([ require('postcss-gradientfixer') ])
```

See [PostCSS] docs for examples for your environment.
