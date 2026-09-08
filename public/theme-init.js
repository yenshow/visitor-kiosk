(function () {
  try {
    var m = document.cookie.match(/(?:^|;\s*)theme=([^;]*)/);
    var t = m && decodeURIComponent(m[1]) === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", t === "dark");
  } catch (e) {}
})();
