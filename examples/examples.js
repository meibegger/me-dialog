
;
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['meDialog'], factory);
  } else {
    factory(meDialog);
  }
}(this, function (meDialog) {

  var
    dialog1 = new meDialog('dialog1'),
    dialog2 = new meDialog('dialog2',{
      backdrop: document.getElementById('backdrop')
    });

  document.getElementById('showDialog1').addEventListener('click',function() {
    dialog1.show(this);
  });
  document.getElementById('showDialog2').addEventListener('click',function() {
    dialog2.show(this);
  });

}));