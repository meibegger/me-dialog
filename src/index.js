(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['me-tools', 'me-lock-view', 'me-show-transition', 'me-trap-focus'], factory);
  } else if (typeof exports === 'object') {
    var
      meTools = require('me-tools'),
      meLockView = require('me-lock-view'),
      meShowTransition = require('me-show-transition'),
      meTrapFocus = require('me-trap-focus');
    if (typeof module === 'object') {
      module.exports = factory(meTools, meLockView, meShowTransition, meTrapFocus);
    } else {
      exports.meDialog = factory(meTools, meLockView, meShowTransition, meTrapFocus);
    }
  } else {
    root.meDialog = factory(root.meTools, root.meLockView, root.meShowTransition, root.meTrapFocus);
  }
}(this, function (meTools, meLockView, meShowTransition, meTrapFocus) {


  var

    /*
     ---------------
     constants
     ---------------
     */

    NAMESPACE = 'meDialog',

    // code of the escape key
    KEY_ESCAPE = 27,

    // if this attribute is set on a dialog container, the dialog will be initialized automatically
    AUTO_INIT = "data-me-dialog",

    // if this attribute is set on an element with the id of the dialog container as value, click on the element will show the dialog (data-me-show-dialog="DIALOG-ID")
    TRIGGER_SHOW = "data-me-show-dialog",

    /*
     ---------------
     settings
     ---------------
     */


    defaultOptions = {
      // set if the dialog is modal; default is true
      modal: true,

      // only relevant if modal=true
      // - selector identifying the backdrop element within the dialog, OR
      // - backdrop element
      backdrop: '.me-backdrop',

      // only relevant if modal=true
      // close the dialog on click on the backdrop; o
      // Note: if true, the behaviour is not according to the WAI ARIA best practices!
      closeOnBackdrop: false,

      // "the label should briefly and adequately describe the dialogs use"
      // - selector identifying the labeling element within the dialog, OR
      // - label text, OR
      // - labelling element
      label: '.me-label',

      // selector identifying the close button(s) within the dialog
      closeSelector: '.me-close',

      // class added to the close button, if the (external) backdrop should not be hidden on close/click
      keepBackdropIndicator: 'me-keep-backdrop',

      // the dialog requires confirmation (like a js confirm box), so ESC will not close the dialog
      requireConfirm: false,

      // attribute set on the container with the view properties passed onShow as value; use this to set states for a specific view of the dialog (e.g. show/hide elements etc.)
      viewPropsAttribute: 'data-view-props',

      // custom action handlers; false for automatic handling or fn
      customHandler: {
        // fn(container) returning an element within the dialog to focus; or false to use the default
        focus: false
      },

      // false or fn(params); params = {container: CONTAINER,backdrop:BACKDROP,trigger:TRIGGER,immediate:BOOL (immediate show/hide call - no transition)}
      callbacks: {
        beforeShow: false,
        beforeShowTransition: false,
        afterShowTransition: false,
        afterShow: false,
        beforeHide: false,
        beforeHideTransition: false,
        afterHideTransition: false,
        afterHide: false
      },

      // see meLockView
      lockView: true,

      // prefix for generated IDs
      idPrefix: 'id-'
    }
    ;

  /*
   ---------------
   meDialog
   ---------------
   */

  /**
   * Create a new instance
   * @param container mixed; required; element or element-id of the dialog element
   * @param options object; optional; overwrite the default settings
   */
  function meDialog(container, options) {
    var that = this;

    // merge options
    initProperties.call(that).options = meTools.mergeObjects(defaultOptions, options);

    initDialog.call(that, container);

  }


  /*
   ---------------
   private functions
   ---------------
   */

  /* setup */

  function initProperties() {
    var that = this;

    that.shown = false; // true from beginning of show until beginning of hide
    that.options = {};

    that.container = null;
    that.backdrop = null;
    that.trigger = null;

    that.meTrapFocus = null;
    that.mainShowTransition = null;
    that.backdropShowTransition = null;

    that.keepBackdrop = false;

    return that;
  }

  function initDialog(container) {
    var
      that = this,
      options = that.options;

    // check arguments
    that.container = initContainer.call(that, container);

    if (options.modal) {
      that.backdrop = initBackdrop.call(that);
    }

    setLabel.call(that);
    initCloseBtn.call(that);
    initFocus.call(that);
    initShow.call(that);
    initTriggers.call(that);

    return that;
  }

  function initContainer(container) {
    // get element
    var
      that = this,
      containerElement = meTools.getElementById(container);

    if (!containerElement) {
      throw NAMESPACE + ': Container element not found';
    }

    // set role
    containerElement.setAttribute('role', 'dialog');

    // register events
    meTools.registerEvent(that, containerElement, 'click', function (event) {
      handleClick.call(that, event);
    });
    meTools.registerEvent(that, containerElement, 'keydown', function (event) {
      handleKeyboard.call(that, event);
    });
    meTools.registerEvent(that, containerElement, 'showdialog', function (event) {
      triggeredShow.call(that, event.detail);
    });
    meTools.registerEvent(that, containerElement, 'hidedialog', function (event) {
      triggeredHide.call(that);
    });

    return containerElement;
  }

  function initBackdrop() {
    var
      that = this,
      options = that.options,
      container = that.container,
      backdropDef = options.backdrop,
      backdropElement = false;

    if (typeof(backdropDef) === 'string') {
      backdropElement = container.querySelector(backdropDef);
    } else if (backdropDef && typeof(backdropDef) === 'object' && typeof(backdropDef.tagName) !== 'undefined') {
      backdropElement = backdropDef;
    }

    if (!backdropElement) {
      throw NAMESPACE + ': Backdrop element not found';
    }

    backdropElement.setAttribute('tabindex', '-1'); // "Set the tabindex of the backdrop element to tabindex="-1" to prevent it from receiving focus via a keyboard event or mouse click."

    meTools.registerEvent(that, backdropElement, 'click', function (event) {
      handleBackdropClick.call(that, event.target);
    });

    // set meShowTransition on the backdrop if it is not contained in the main dialog container
    if (!meTools.isParent(that.container, backdropElement)) {
      // build meShowTransition options
      var _options = meTools.copyValues(that.options);
      _options.callbacks = {}; // remove all callbacks

      if (backdropElement.data && backdropElement.data[NAMESPACE] && backdropElement.data[NAMESPACE].transition) { // backdrop already has a transition assigned (for instance if multiple dialogs use the same backdrop)
        that.backdropShowTransition = backdropElement.data[NAMESPACE].transition; // link the existing transition to the dialog instance
        backdropElement.data[NAMESPACE].assignedTransitions++; // remember the new linkage

      } else {
        // create transition instance
        that.backdropShowTransition = new meShowTransition(backdropElement, _options);

        // save transition instance
        backdropElement.data = backdropElement.data || {};
        backdropElement.data[NAMESPACE] = backdropElement.data[NAMESPACE] || {};
        backdropElement.data[NAMESPACE].transition = that.backdropShowTransition;
        backdropElement.data[NAMESPACE].assignedTransitions = 1;
      }
    }

    return backdropElement;
  }

  function setLabel() {
    var
      that = this,
      options = that.options,
      container = that.container,
      labelDef = options.label,
      labelElement = false;

    if (typeof(labelDef) === 'string') {
      labelElement = container.querySelector(labelDef);
    } else if (typeof(labelDef) === 'object' && typeof(labelDef.tagName) !== 'undefined') {
      labelElement = labelDef;
    }

    if (labelElement) {
      container.setAttribute('aria-labelledby', meTools.getId(labelElement, options.idPrefix));

    } else if (typeof(labelDef) === 'string') {
      container.setAttribute('aria-label', labelDef);

    } else {
      throw NAMESPACE + ': Label element not found';
    }

    return that;
  }

  function initCloseBtn() {
    var
      that = this,
      closeButtons = that.container.querySelectorAll(that.options.closeSelector),
      _hide = function () {
        if (this.className.indexOf(that.options.keepBackdropIndicator) !== -1) {
          that.keepBackdrop = true;
        }
        hide.call(that);
      };

    for (var i = 0; i < closeButtons.length; i++) {
      meTools.registerEvent(that, closeButtons[i], 'click', _hide);
    }

    return that;
  }

  function initFocus() {
    var
      that = this,
      container = that.container;

    that.meTrapFocus = new meTrapFocus(container, that.options);

    // add tabindex to the dialog to be able to focus it if there is no focusable element inside
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('data-tabindexed', 'true');
      container.setAttribute('tabindex', '-1');
    }

    return that;
  }

  function initShow() {
    var
      that = this,
      options = that.options,
      callbacks = options.callbacks,

      // build meShowTransition options
      _options = meTools.copyValues(options);
    _options.callbacks = {}; // remove all callbacks

    /* adjust callbacks */

    // call user-defined callback
    function customCallback(data, name) {
      if (callbacks[name]) {

        // add custom properties
        data.backdrop = that.backdrop;
        data.trigger = that.trigger;

        callbacks[name](data);
      }
    }

    function passCustomCallback(name) {
      return function (data) {
        customCallback(data, name);
      };
    }

    function beforeShow(data) {

      // call user-defined beforeShow
      customCallback(data, 'beforeShow');

      // show the backdrop
      if (that.backdropShowTransition) {
        that.backdropShowTransition.show(data.immediate);
      }

      // lock the view
      if (options.lockView) {
        meLockView.lock();
      }

      // set wai-aria attributes
      if (that.trigger) {
        that.trigger.setAttribute('aria-expanded', 'true');
      }
      that.container.setAttribute('aria-hidden', 'false');

    }

    function afterShow(data) {

      // fetch the focusable elements
      that.meTrapFocus.update();

      // set the focus inside of the dialog
      setFocus.call(that);

      // call user-defined beforeShowTransition
      customCallback(data, 'afterShow');
    }

    function beforeHide(data) {

      // call user-defined beforeHide
      customCallback(data, 'beforeHide');

      // hide the backdrop
      if (that.backdropShowTransition && !that.keepBackdrop) {
        that.backdropShowTransition.hide(data.immediate);
      }

      // focus the trigger
      if (that.trigger) {
        // set wai-aria attributes
        that.trigger.setAttribute('aria-expanded', 'false');
        unsetTrigger.call(focusTrigger.call(that));
      }

    }

    function afterHide(data) {

      // clear the view specific properties
      clearViewProps.call(that);

      // unlock the view
      if (options.lockView) {
        meLockView.unlock(!that.keepBackdrop);
      }
      that.keepBackdrop = false;

      // set wai-aria attributes
      that.container.setAttribute('aria-hidden', 'true');

      // call user-defined afterHide
      customCallback(data, 'afterHide');

    }

    _options.callbacks = { // false or fn(params); params = {container: CONTAINER,backdrop:UNDERLAY,trigger:TRIGGER,immediate:BOOL (immediate show/hide call - no transition)}
      beforeShow: beforeShow,
      beforeShowTransition: passCustomCallback('beforeShowTransition'),
      afterShowTransition: passCustomCallback('afterShowTransition'),
      afterShow: afterShow,
      beforeHide: beforeHide,
      beforeHideTransition: passCustomCallback('beforeHideTransition'),
      afterHideTransition: passCustomCallback('afterHideTransition'),
      afterHide: afterHide
    };


    // init meShowTransition
    that.mainShowTransition = new meShowTransition(that.container, _options);

    return that;
  }

  function initTriggers() {
    var
      that = this,
      dialogId = meTools.getId(that.container, that.options.idPrefix),
      triggers = document.querySelectorAll('[' + TRIGGER_SHOW + '="' + dialogId + '"]');

    for (var i = 0; i < triggers.length; i++) {
      var trigger = triggers[i];
      trigger.setAttribute('aria-controls', dialogId);
      trigger.setAttribute('aria-expanded', 'false');
      meTools.registerEvent(that, trigger, 'click', that.show.bind(that, trigger));
    }

    return that;
  }

  /* display */

  /**
   *
   * @param immediate Bool; show immediately (without transition)
   * @param viewProps
   * @returns {show}
   */
  function show(immediate, viewProps) {
    addViewProps.call(this, viewProps);
    this.mainShowTransition.show(immediate);
    return this;
  }

  function hide(immediate) {
    this.mainShowTransition.hide(immediate);
    return this;
  }

  function addViewProps(viewProps) {
    var that = this;
    if (viewProps) {
      that.container.setAttribute(that.options.viewPropsAttribute,viewProps);
    }
    return that;
  }

  function clearViewProps() {
    var that = this;
    that.container.removeAttribute(that.options.viewPropsAttribute);
    return that;
  }

  /* events */

  function triggeredShow(detail) {
    this.show(detail.trigger);
  }

  function triggeredHide() {
    this.hide();
  }

  function handleClick(event) {
    var
      that = this,
      options = that.options;
  }

  function handleKeyboard(event) {
    if (!event.ctrlKey && !event.altKey) {
      var code = (event.keyCode ? event.keyCode : event.which);

      if (!this.options.requireConfirm && code == KEY_ESCAPE) {
        hide.call(this);
        event.stopPropagation();
      }
    }
  }

  function handleBackdropClick(target) {
    var that = this;

    if (that.backdrop == target) {
      if (that.options.closeOnBackdrop) {
        hide.call(that);
      } else {
        that.container.focus();
      }
    }

    return that;
  }

  /* handle trigger element */

  function setTrigger(trigger) {
    this.trigger = trigger;
    return this;
  }

  function focusTrigger() {
    var that = this;
    if (that.trigger) {
      that.trigger.focus();
    }
    return that;
  }

  function unsetTrigger() {
    this.trigger = null;
    return this;
  }

  /* focus */

  function setFocus() {
    var
      that = this,
      options = that.options,
      getFocusElement = options.customHandler.focus,
      focus = null,
      focusables = that.meTrapFocus.getTabable();

    if (typeof getFocusElement === 'function') {
      focus = getFocusElement(that.container);
    }
    if (!focus) {
      for (var i = 0; i < focusables.length; i++) {
        if (!focusables[i].matches(options.closeSelector)) {
          focus = focusables[i];
          break;
        }
      }
    }
    if (!focus && focusables.length) {
      focus = focusables[0];
    }

    (focus || (focusables.length ? focusables[0] : that.container)).focus();
  }

  /*
   ---------------
   prototype
   ---------------
   */

  /**
   * Show the dialog
   * @param trigger DOM-element; optional; the element, that triggered the show
   * @param immediate Bool; optional; default is false; show immediately (without transition)
   * @param viewProps String; optional; string to add to the container in the viewPropsAttribute
   * @param event eventObject; optional;
   * @returns {meDialog}
   */
  meDialog.prototype.show = function () {
    var
      that = this,
      trigger,
      immediate,
      viewProps;
    for (var i=0; i<arguments.length; i++) {
      var
        argument = arguments[i],
        type = typeof argument;

      if (type === 'boolean') {
        immediate = argument;
      } else if (type === 'string') {
        viewProps = argument;
      } else if (type === 'object') {
        if (argument.tagName) {
          trigger = argument;
        } else if (argument.preventDefault) {
          argument.preventDefault();
        }
      }
    }
    if (trigger) {
      setTrigger.call(that, trigger);
    }
    return show.call(that, immediate, viewProps);
  };

  /**
   * Hide the dialog
   * @returns {meDialog}
   */
  meDialog.prototype.hide = function () {
    return hide.call(this);
  };

  /**
   * Update the list of focusable elements in the dialog.
   * Call this function, if elements were added or removed while the dialog is shown
   * @returns {meDialog}
   */
  meDialog.prototype.update = function () {
    this.meTrapFocus.update();
    return this;
  };

  /**
   * @returns {boolean} true if the component is in the process of hiding or hidden
   */
  meDialog.prototype.canShow = function () {
    return this.mainShowTransition.canShow();
  };

  /**
   * Destroy the widget
   * @returns {null}
   */
  meDialog.prototype.destroy = function () {
    var
      that = this,
      container = that.container;

    container.removeAttribute('role');
    container.removeAttribute('aria-hidden');
    container.removeAttribute('aria-labelledby');
    container.removeAttribute('aria-label');

    that.backdrop.removeAttribute('tabindex');
    if (container.getAttribute('data-tabindexed')) {
      container.removeAttribute('data-tabindexed');
      container.removeAttribute('tabindex');
    }

    if (that.trigger) {
      that.trigger.removeAttribute('aria-expanded');
    }

    meLockView.unlock(!that.keepBackdrop);

    meTools.unregisterEvent(that);

    that.meTrapFocus.destroy();
    that.mainShowTransition.destroy();

    if (that.backdropShowTransition) {
      if (that.backdrop.data[NAMESPACE].assignedTransitions > 1) { // an other dialog still depends on the the backdrop transition
        that.backdrop.data[NAMESPACE].assignedTransitions--; // remove the linkage

      } else {
        that.backdropShowTransition.destroy(); // destroy the transition instance
      }
    }

    initProperties.call(that);

    return null;
  };

  /*
   ---------------
   automatic initialization
   ---------------
   */

  /**
   * Auto init all dialogs with the attribute AUTO_INIT
   */
  function autoInit() {
    var dialogs = document.querySelectorAll('[' + AUTO_INIT + ']');
    for (var i = 0; i < dialogs.length; i++) {
      new meDialog(dialogs[i]);
    }
  }

  // auto-initialize marked dialogs as soon as the document has finished loading. We can now access the DOM elements.
  if ( document.attachEvent ? document.readyState === 'complete' : document.readyState !== 'loading' ) {
    autoInit();
  } else {
    window.addEventListener('DOMContentLoaded', function loaded() {
      window.removeEventListener('DOMContentLoaded', loaded);
      autoInit();
    });
  }

  /*
   ---------------
   return
   ---------------
   */

  return meDialog;

}));
