# meDialog #

An accessible javascript dialog widget as described at [WAI-ARIA 1.0 Authoring Practices - Dialog (Modal) (widget)](http://www.w3.org/TR/2013/WD-wai-aria-practices-20130307/#dialog_modal)

## Usage ##

### 1. Include the JavaScript ###
#### Bundled & minified versions ####

meDialog depends on 

- [meTools](https://github.com/meibegger/me-tools)
- [meLockView](https://github.com/meibegger/me-lock-view)
- [meShowTransition](https://github.com/meibegger/me-show-transition)
- [meTrapFocus](https://github.com/meibegger/me-trap-focus)

It also uses `Element.matches`, so you need to include a polyfill to support IE (see [http://caniuse.com/#feat=matchesselector](http://caniuse.com/#feat=matchesselector)), which you can find at [mePolyfills](https://github.com/meibegger/me-polyfills) in the sources-folder.

- Either include all the dependencies yourself and include `me-dialog.min.js` from the `dist` folder in your HTML page.
- or use one of the standalone bundles `me-dialog.bundle.min.js` or `me-dialog.bundle.ie9.min.js`.

#### Source versions ####
You can find the original JavaScript file in the `src` folder of this package.

#### AMD ####
meShowTransition has AMD support. This allows it to be lazy-loaded with an AMD loader, such as RequireJS.

### 2. Default CSS ###

There is a default dialog CSS in the `dist` folder.

### 3. Use meDialog ###

I still need to write a documentation. In the meantime please see the examples and the source-code for more info.

## Package managers ##
You can install meDialog using npm or Bower.

```
$ npm install me-dialog
```

or

```
$ bower install me-dialog
```

## License ##
meDialog is licenses under the [MIT licence](https://opensource.org/licenses/MIT).