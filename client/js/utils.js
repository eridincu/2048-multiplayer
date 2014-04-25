window.hash = function(size) {
  var chars = '123456789ABCDEFGHJKPQRSTUVWXYZabcdefghkpqrstuvwxyz',
    len = chars.length,
    hash = '';
  size = !isNaN(size) ? Math.max(size, 3) : 3;
  for (var x = 0; x < size; x++) {
    if (x === 0) {
      // do not start with a number
      hash += chars.charAt(Math.floor(Math.random() * (len - 10) + 10));
    } else {
      hash += chars.charAt(Math.floor(Math.random() * len));
    }
  }
  return hash;
};
